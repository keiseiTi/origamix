import type { DiagnosticLogger } from '../logging/logger';
import { agentTarget, requireAgentTarget } from './agent-target';
import {
  type ClarificationResult,
  type CreateAgentRunRequest,
  type RuntimeRepairEvidence,
  type RunBudget,
  type OrigamixPageSchema,
} from '@origamix/shared';

import type { AgentEventBroker } from './event-broker';
import type { RunExecutor, RunResult } from './run-executor';
import type { AgentRunRecord } from './run-repository';
import type { AgentRunService } from './run-service';
import type {
  ConversationService,
  StartConversationRunInput,
} from '../conversations/conversation-service';
import { KeyedQueue } from '../infrastructure/keyed-queue';
import { getAgentModel, DEEPSEEK_FLASH_MODEL_ID } from './agent-engine';
import { conflict, notFound } from '../errors';
import { progressPayload } from './progress';
import { redactAgentMessage } from './safe-error';
import type { AgentConversations, AgentProjects, AgentRunStore } from './persistence';
import { withProjectActivity } from '../projects/project-activity';
import { ApiError } from '../errors';

export { DEFAULT_AGENT_RUN_BUDGET } from './run-budget';
import { DEFAULT_AGENT_RUN_BUDGET } from './run-budget';

export interface StartedAgentRun {
  run: AgentRunRecord;
  conversationId: string;
  userMessageId: string;
  /** Present while this process owns execution. HTTP returns only the persisted identifiers. */
  completion?: Promise<RunResult>;
}

export class AgentService {
  private readonly starts = new KeyedQueue();
  private readonly admission = new KeyedQueue();
  private readonly executing = new Map<string, Promise<RunResult>>();
  private readonly starting = new Set<Promise<StartedAgentRun>>();
  private closing = false;
  private shutdownPromise?: Promise<void>;

  constructor(
    private readonly dependencies: {
      logger?: DiagnosticLogger;
      conversations: AgentConversations;
      runs: AgentRunStore;
      runService: AgentRunService;
      events: AgentEventBroker;
      executor: RunExecutor;
      getCurrentState: (
        projectId: string,
        pageId: string | undefined,
      ) =>
        | { workingVersion: number; workingHash?: string; schema?: OrigamixPageSchema }
        | Promise<{ workingVersion: number; workingHash?: string; schema?: OrigamixPageSchema }>;
      modelRef?: string;
      getModelRef?: () => string | Promise<string>;
      budget?: RunBudget;
      projects: Pick<AgentProjects, 'getProject'>;
      maxConcurrentRuns?: number;
    },
  ) {}

  async start(request: CreateAgentRunRequest, requestId?: string): Promise<StartedAgentRun> {
    if (this.closing) throw conflict('服务正在关闭，不能启动新的 Agent Run');
    const project = await this.dependencies.projects.getProject(request.projectId);
    if (!project) throw notFound('项目不存在');
    const target = requireAgentTarget(request);
    const admit = () =>
      this.starts.run(`${request.projectId}\0${target.kind}\0${request.pageId ?? ''}`, async () => {
        this.assertOpen();
        const duplicate = await this.dependencies.runs.findByClientRequest(
          request.projectId,
          request.pageId,
          request.clientRequestId,
        );
        if (duplicate) {
          // Reuse the durable configuration, but still validate request identity/content.
          const started = await this.dependencies.conversations.startRun({
            ...request,
            ...this.runConfiguration(duplicate),
          });
          return this.startResult(started, requestId);
        }
        const current = await this.dependencies.getCurrentState(request.projectId, request.pageId);
        this.assertOpen();
        if (current.workingVersion !== request.baseWorkingVersion) {
          throw conflict('页面版本已变化，请刷新后重试');
        }
        const evidenceBlocks = request.content.blocks.filter(
          (block) => block.type === 'runtime_repair',
        );
        const evidence = evidenceBlocks[0];
        if (evidence) {
          const schema = current.schema;
          const flow =
            schema && Object.hasOwn(schema.flows, evidence.flowId)
              ? schema.flows[evidence.flowId]
              : undefined;
          if (
            evidenceBlocks.length !== 1 ||
            evidence.workingHash !== current.workingHash ||
            !schema ||
            !Object.hasOwn(schema.elements, evidence.elementId) ||
            !schema.bindElements.some(
              (binding) => binding.id === evidence.elementId && binding.flowId === evidence.flowId,
            ) ||
            !flow ||
            !Object.hasOwn(flow.nodes, evidence.nodeId) ||
            !evidence.visited.every((id) => Object.hasOwn(flow.nodes, id)) ||
            (evidence.failure.code !== 'NODE_EXECUTION_ERROR' &&
              flow.nodes[evidence.nodeId]?.type !== 'interfaceRequest')
          ) {
            throw conflict('预览运行证据已过期或与当前页面流程不匹配，请刷新预览后重现。');
          }
        }
        if (request.clarification) {
          const source = await this.dependencies.runs.get(request.clarification.runId);
          const clarification = source?.outcomeJson as ClarificationResult | undefined;
          const candidate = clarification?.candidates?.find(
            (item) => item.elementId === request.clarification?.selectedElementId,
          );
          if (
            !source ||
            source.status !== 'completed' ||
            source.outcome !== 'needs_clarification' ||
            source.projectId !== request.projectId ||
            source.pageId !== request.pageId ||
            source.conversationId !== request.conversationId ||
            clarification?.clarificationId !== request.clarification.clarificationId ||
            clarification.baseWorkingVersion !== request.baseWorkingVersion ||
            !candidate ||
            (current.schema && !current.schema.elements[candidate.elementId])
          ) {
            throw conflict('澄清选项已过期或不属于当前页面');
          }
        }
        const message = request.content.blocks
          .filter(
            (block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text',
          )
          .map((block) => block.text)
          .join('\n')
          .trim();
        const modelRef = this.dependencies.getModelRef
          ? await this.dependencies.getModelRef()
          : (this.dependencies.modelRef ?? DEEPSEEK_FLASH_MODEL_ID);
        this.assertOpen();
        if (this.dependencies.getModelRef) getAgentModel(modelRef);
        const started = await this.admission.run('active-runs', async () => {
          this.assertOpen();
          const active = await this.dependencies.runs.listActive();
          if (
            active.some(
              (run) => run.projectId === request.projectId && run.pageId === request.pageId,
            )
          )
            throw conflict('当前页面已有 Agent 正在运行，请等待完成或先取消');
          if (active.length >= (this.dependencies.maxConcurrentRuns ?? 4))
            throw new ApiError('Agent 并发已达上限，请等待其他页面完成', 429);
          return this.dependencies.conversations.startRun({
            ...request,
            modelRef,
            runKind: 'page_assistant',
            budget: this.dependencies.budget ?? DEFAULT_AGENT_RUN_BUDGET,
            promptVersion: '1',
            policyVersion: '1',
            toolsetVersion: '1',
            materialManifestVersion: 'official-antd@1.0.0',
          });
        });
        if (started.created) {
          this.dependencies.events.publish({
            type: 'run.queued',
            runId: started.run.id,
            pageId: started.run.pageId,
            target: agentTarget(started.run.projectId, started.run.pageId),
            requestId: started.run.clientRequestId,
            payload: { status: started.run.status },
          });
          // HTTP and synchronous callers share this single dispatch and completion.
          const completion = Promise.resolve()
            .then(() => this.executeAndPublish(started, message, evidence))
            .finally(() => {
              this.executing.delete(started.run.id);
            });
          this.executing.set(started.run.id, completion);
          // HTTP acknowledges before execution completes; still observe background rejection.
          void completion.catch(() => undefined);
        }
        return this.startResult(started, requestId);
      });
    const pending = withProjectActivity(project.path, admit);
    this.starting.add(pending);
    const remove = () => {
      this.starting.delete(pending);
    };
    void pending.then(remove, remove);
    return pending;
  }

  /** A timeout leaves persistence open: an uncooperative task must never outlive its database. */
  shutdown(timeoutMs = 10_000): Promise<void> {
    this.closing = true;
    if (this.shutdownPromise) return this.shutdownPromise;
    let timer: ReturnType<typeof setTimeout>;
    const drain = async () => {
      for (const runId of this.executing.keys()) await this.cancel(runId, 'server-shutdown');
      await Promise.allSettled([...this.starting]);
      await Promise.allSettled([...this.executing.values()]);
    };
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error('Agent 关闭超时，数据库仍保留供活动请求收敛，请重试关闭')),
        timeoutMs,
      );
    });
    this.shutdownPromise = Promise.race([drain(), timeout]).finally(() => {
      clearTimeout(timer);
      this.shutdownPromise = undefined;
    });
    return this.shutdownPromise;
  }

  private assertOpen(): void {
    if (this.closing) throw conflict('服务正在关闭，不能启动新的 Agent Run');
  }

  async get(runId: string): Promise<AgentRunRecord> {
    return await this.dependencies.runService.get(runId);
  }

  async cancel(runId: string, requestId: string): Promise<AgentRunRecord> {
    const run = await this.dependencies.runService.cancel(runId);
    this.dependencies.executor.cancel(runId);
    const progress = progressPayload(run.status);
    if (progress)
      this.dependencies.events.publish({
        type: 'run.progress',
        runId,
        pageId: run.pageId,
        target: agentTarget(run.projectId, run.pageId),
        requestId,
        payload: progress,
      });
    return run;
  }

  private async executeAndPublish(
    started: ReturnType<ConversationService['startRun']>,
    message: string,
    evidence?: RuntimeRepairEvidence,
  ): Promise<RunResult> {
    let result: RunResult;
    try {
      result = await this.dependencies.executor.execute(started, message, evidence);
    } catch {
      // A rejected setup must settle durable state as well as notify subscribers.
      const current = await this.dependencies.runService.get(started.run.id);
      if (!['completed', 'failed', 'cancelled', 'interrupted'].includes(current.status)) {
        await this.dependencies.runService.transition(current.id, 'failed', {
          errorCode: 'INTERNAL_ERROR',
          errorMessage: 'Agent 运行失败，请重试。',
        });
        await this.dependencies.conversations.failAssistant(
          current.id,
          {
            version: '1',
            blocks: [{ type: 'text', text: '本次请求未完成，请重试。' }],
          },
          'AGENT_FAILED',
        );
      }
      const settled = await this.dependencies.runService.get(current.id);
      result = {
        runId: settled.id,
        status: settled.status as RunResult['status'],
        text: '',
        ...(settled.resultWorkingVersion
          ? { resultWorkingVersion: settled.resultWorkingVersion }
          : {}),
      };
    }
    const settled = await this.dependencies.runService.get(result.runId);
    if (settled.resultWorkingVersion) {
      this.dependencies.events.publish({
        type: 'working.committed',
        runId: settled.id,
        pageId: settled.pageId,
        target: agentTarget(settled.projectId, settled.pageId),
        requestId: settled.clientRequestId,
        payload: {
          baseWorkingVersion: settled.baseWorkingVersion,
          resultWorkingVersion: settled.resultWorkingVersion,
          operationCount: settled.operationCount ?? 1,
        },
      });
    }
    if (settled.outcome === 'needs_clarification' && settled.outcomeJson) {
      this.dependencies.events.publish({
        type: 'clarification.available',
        runId: settled.id,
        pageId: settled.pageId,
        target: agentTarget(settled.projectId, settled.pageId),
        requestId: settled.clientRequestId,
        payload: {
          status: 'completed',
          outcome: 'needs_clarification',
          clarification: settled.outcomeJson,
        },
      });
    }
    const payload =
      settled.status === 'completed'
        ? {
            status: 'completed' as const,
            outcome: settled.outcome ?? result.outcome ?? ('answered_only' as const),
            ...(result.text ? { response: result.text } : {}),
            ...(settled.resultWorkingVersion
              ? { resultWorkingVersion: settled.resultWorkingVersion }
              : {}),
          }
        : settled.status === 'failed'
          ? {
              status: 'failed' as const,
              errorCode: settled.errorCode ?? 'INTERNAL_ERROR',
              safeMessage: redactAgentMessage(settled.errorMessage ?? 'Agent 运行失败，请重试。'),
            }
          : { status: settled.status };
    this.dependencies.events.publish({
      type: `run.${settled.status}`,
      runId: result.runId,
      pageId: started.run.pageId,
      target: agentTarget(started.run.projectId, started.run.pageId),
      requestId: started.run.clientRequestId,
      payload,
    });
    return result;
  }

  private startResult(
    started: ReturnType<ConversationService['startRun']>,
    requestId?: string,
  ): StartedAgentRun {
    const { id, projectId, pageId, baseWorkingVersion } = started.run;
    this.dependencies.logger?.info({
      event: started.created ? 'agent.run.accepted' : 'agent.run.reused',
      requestId,
      runId: id,
      projectId,
      pageId,
      baseWorkingVersion,
    });
    return {
      run: started.run,
      conversationId: started.conversation.id,
      userMessageId: started.message.messageId,
      completion: this.executing.get(started.run.id),
    };
  }

  private runConfiguration(
    run: AgentRunRecord,
  ): Pick<
    StartConversationRunInput,
    | 'runKind'
    | 'modelRef'
    | 'budget'
    | 'promptVersion'
    | 'policyVersion'
    | 'toolsetVersion'
    | 'materialManifestVersion'
  > {
    return {
      runKind: run.runKind,
      modelRef: run.modelRef,
      budget: run.budget,
      promptVersion: run.promptVersion,
      policyVersion: run.policyVersion,
      toolsetVersion: run.toolsetVersion,
      materialManifestVersion: run.materialManifestVersion,
    };
  }
}
