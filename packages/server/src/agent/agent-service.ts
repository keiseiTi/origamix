import {
  type ClarificationResult,
  type CreateAgentRunRequest,
  type RunBudget,
  type OrigamixPageSchema,
} from '@origamix/shared';

import type { AgentEventBroker } from './event-broker';
import type { RunExecutor, RunResult } from './run-executor';
import type { AgentRunRepository, AgentRunRecord } from './run-repository';
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
import type { ProjectRepository } from '../projects/project-repository';
import { withProjectActivity } from '../projects/project-activity';
import { ApiError } from '../errors';

export const DEFAULT_AGENT_RUN_BUDGET: RunBudget = {
  maxModelCalls: 10,
  // Logic generation reads both material and node contracts, then reserves room for repair.
  maxToolCalls: 40,
  maxOutputTokens: 32_000,
  maxInputTokens: 400_000,
  maxTotalTokens: 432_000,
  maxRequestInputTokens: 128_000,
  maxRequestOutputTokens: 16_000,
  maxDurationMs: 180_000,
  maxSchemaBytes: 512 * 1024,
  maxOperationBytes: 256 * 1024,
  maxRepairAttempts: 2,
};

export interface StartedAgentRun {
  run: AgentRunRecord;
  conversationId: string;
  userMessageId: string;
  /** Present while this process owns execution. HTTP returns only the persisted identifiers. */
  completion?: Promise<RunResult>;
}

export class AgentService {
  private readonly starts = new KeyedQueue();
  private readonly executing = new Map<string, Promise<RunResult>>();
  private readonly starting = new Set<Promise<StartedAgentRun>>();
  private closing = false;
  private shutdownPromise?: Promise<void>;

  constructor(
    private readonly dependencies: {
      conversations: ConversationService;
      runs: AgentRunRepository;
      runService: AgentRunService;
      events: AgentEventBroker;
      executor: RunExecutor;
      getCurrentState: (
        projectId: string,
        pageId: string,
      ) =>
        | { workingVersion: number; schema?: OrigamixPageSchema }
        | Promise<{ workingVersion: number; schema?: OrigamixPageSchema }>;
      modelRef?: string;
      getModelRef?: () => string | Promise<string>;
      budget?: RunBudget;
      projects: Pick<ProjectRepository, 'getProject'>;
      maxConcurrentRuns?: number;
    },
  ) {}

  start(request: CreateAgentRunRequest): Promise<StartedAgentRun> {
    if (this.closing) return Promise.reject(conflict('服务正在关闭，不能启动新的 Agent Run'));
    const admit = () =>
      this.starts.run(`${request.projectId}\0${request.pageId}`, async () => {
        this.assertOpen();
        const duplicate = this.dependencies.runs.findByClientRequest(
          request.projectId,
          request.pageId,
          request.clientRequestId,
        );
        if (duplicate) {
          // Reuse the durable configuration, but still validate request identity/content.
          const started = this.dependencies.conversations.startRun({
            ...request,
            ...this.runConfiguration(duplicate),
          });
          return this.startResult(started);
        }
        const current = await this.dependencies.getCurrentState(request.projectId, request.pageId);
        this.assertOpen();
        if (current.workingVersion !== request.baseWorkingVersion) {
          throw conflict('页面版本已变化，请刷新后重试');
        }
        if (request.clarification) {
          const source = this.dependencies.runs.get(request.clarification.runId);
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
        const active = this.dependencies.runs.listActive();
        if (
          active.some((run) => run.projectId === request.projectId && run.pageId === request.pageId)
        )
          throw conflict('当前页面已有 Agent 正在运行，请等待完成或先取消');
        if (active.length >= (this.dependencies.maxConcurrentRuns ?? 4))
          throw new ApiError('Agent 并发已达上限，请等待其他页面完成', 429);
        const started = this.dependencies.conversations.startRun({
          ...request,
          modelRef,
          runKind: 'page_assistant',
          budget: this.dependencies.budget ?? DEFAULT_AGENT_RUN_BUDGET,
          promptVersion: '3',
          policyVersion: '1',
          toolsetVersion: '2',
          materialManifestVersion: 'official-antd@1.0.0',
        });
        if (started.created) {
          this.dependencies.events.publish({
            type: 'run.queued',
            runId: started.run.id,
            pageId: started.run.pageId,
            requestId: started.run.clientRequestId,
            payload: { status: started.run.status },
          });
          // HTTP and synchronous callers share this single dispatch and completion.
          const completion = Promise.resolve()
            .then(() => this.executeAndPublish(started, message))
            .finally(() => {
              this.executing.delete(started.run.id);
            });
          this.executing.set(started.run.id, completion);
          // HTTP acknowledges before execution completes; still observe background rejection.
          void completion.catch(() => undefined);
        }
        return this.startResult(started);
      });
    const project = this.dependencies.projects.getProject(request.projectId);
    if (!project) return Promise.reject(notFound('项目不存在'));
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
      for (const runId of this.executing.keys()) this.cancel(runId, 'server-shutdown');
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

  get(runId: string): AgentRunRecord {
    return this.dependencies.runService.get(runId);
  }

  cancel(runId: string, requestId: string): AgentRunRecord {
    const run = this.dependencies.runService.cancel(runId);
    this.dependencies.executor.cancel(runId);
    const progress = progressPayload(run.status);
    if (progress)
      this.dependencies.events.publish({
        type: 'run.progress',
        runId,
        pageId: run.pageId,
        requestId,
        payload: progress,
      });
    return run;
  }

  private async executeAndPublish(
    started: ReturnType<ConversationService['startRun']>,
    message: string,
  ): Promise<RunResult> {
    let result: RunResult;
    try {
      result = await this.dependencies.executor.execute(started, message);
    } catch {
      // A rejected setup must settle durable state as well as notify subscribers.
      const current = this.dependencies.runService.get(started.run.id);
      if (!['completed', 'failed', 'cancelled', 'interrupted'].includes(current.status)) {
        this.dependencies.runService.transition(current.id, 'failed', {
          errorCode: 'INTERNAL_ERROR',
          errorMessage: 'Agent 运行失败，请重试。',
        });
        this.dependencies.conversations.failAssistant(
          current.id,
          {
            version: '1',
            blocks: [{ type: 'text', text: '本次请求未完成，请重试。' }],
          },
          'AGENT_FAILED',
        );
      }
      const settled = this.dependencies.runService.get(current.id);
      result = {
        runId: settled.id,
        status: settled.status as RunResult['status'],
        text: '',
        ...(settled.resultWorkingVersion
          ? { resultWorkingVersion: settled.resultWorkingVersion }
          : {}),
      };
    }
    const settled = this.dependencies.runService.get(result.runId);
    if (settled.resultWorkingVersion) {
      this.dependencies.events.publish({
        type: 'working.committed',
        runId: settled.id,
        pageId: settled.pageId,
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
      requestId: started.run.clientRequestId,
      payload,
    });
    return result;
  }

  private startResult(started: ReturnType<ConversationService['startRun']>): StartedAgentRun {
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
