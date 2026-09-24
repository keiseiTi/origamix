import type {
  ClarificationResult,
  CreateAgentRunRequest,
  RunBudget,
} from '@origamix/shared/protocol/agent';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import type { AgentEventBroker } from './event-broker';
import type { RunExecutor, RunResult } from './run-executor';
import type { AgentRunRepository, AgentRunRecord } from './run-repository';
import type { AgentRunService } from './run-service';
import type {
  ConversationService,
  StartConversationRunInput,
} from '../conversations/conversation-service';
import { KeyedQueue } from '../infrastructure/keyed-queue';
import { getAgentModel, MVP_MODEL_ID } from './engine';
import { conflict } from '../errors';
import { progressPayload } from './progress';

export const DEFAULT_AGENT_RUN_BUDGET: RunBudget = {
  maxModelCalls: 6,
  maxToolCalls: 12,
  maxOutputTokens: 16_000,
  maxDurationMs: 120_000,
  maxSchemaBytes: 256 * 1024,
  maxRepairAttempts: 1,
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
    },
  ) {}

  start(request: CreateAgentRunRequest): Promise<StartedAgentRun> {
    return this.starts.run(`${request.projectId}\0${request.pageId}`, async () => {
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
        .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();
      const modelRef = this.dependencies.getModelRef
        ? await this.dependencies.getModelRef()
        : (this.dependencies.modelRef ?? MVP_MODEL_ID);
      if (this.dependencies.getModelRef) getAgentModel(modelRef);
      const started = this.dependencies.conversations.startRun({
        ...request,
        modelRef,
        runKind: 'page_assistant',
        budget: this.dependencies.budget ?? DEFAULT_AGENT_RUN_BUDGET,
        promptVersion: '1',
        policyVersion: '1',
        toolsetVersion: '1',
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
      }
      return this.startResult(started);
    });
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
              safeMessage: settled.errorMessage ?? 'Agent 运行失败，请重试。',
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
