import type { CreateAgentRunRequest, PageIntent, RunBudget } from '@origamix/shared/protocol/agent';
import type { AgentEventBroker } from './event-broker';
import type { RunExecutor, RunResult } from './run-executor';
import type { AgentRunRepository, AgentRunRecord } from './run-repository';
import type { AgentRunService } from './run-service';
import type { ScopeRouter } from './scope-router';
import type {
  ConversationService,
  StartConversationRunInput,
} from '../conversations/conversation-service';
import { KeyedQueue } from '../infrastructure/keyed-queue';
import { getAgentModel, MVP_MODEL_ID } from './engine';
import { conflict } from '../errors';

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
      router: ScopeRouter;
      getCurrentState: (
        projectId: string,
        pageId: string,
      ) => { workingVersion: number } | Promise<{ workingVersion: number }>;
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
      const message = request.content.blocks
        .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();
      const intent = await this.dependencies.router.route(message, request.pageId);
      const modelRef = this.dependencies.getModelRef
        ? await this.dependencies.getModelRef()
        : (this.dependencies.modelRef ?? MVP_MODEL_ID);
      if (this.dependencies.getModelRef) getAgentModel(modelRef);
      const started = this.dependencies.conversations.startRun({
        ...request,
        modelRef,
        mode: intent.mode,
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
          .then(() => this.executeAndPublish(started, intent, message))
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
    const terminal = ['completed', 'failed', 'cancelled', 'interrupted'].includes(run.status);
    this.dependencies.events.publish({
      type: terminal ? `run.${run.status}` : 'run.cancelling',
      runId,
      pageId: run.pageId,
      requestId,
      payload: { status: run.status },
    });
    return run;
  }

  private async executeAndPublish(
    started: ReturnType<ConversationService['startRun']>,
    intent: PageIntent,
    message: string,
  ): Promise<RunResult> {
    let result: RunResult;
    try {
      result = await this.dependencies.executor.execute(started, intent, message);
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
        mode: settled.mode,
        status: settled.status as RunResult['status'],
        text: '',
        ...(settled.resultWorkingVersion
          ? { resultWorkingVersion: settled.resultWorkingVersion }
          : {}),
      };
    }
    this.dependencies.events.publish({
      type: `run.${result.status}`,
      runId: result.runId,
      pageId: started.run.pageId,
      requestId: started.run.clientRequestId,
      payload: {
        status: result.status,
        ...(result.resultWorkingVersion ? { workingVersion: result.resultWorkingVersion } : {}),
      },
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
    | 'mode'
    | 'modelRef'
    | 'budget'
    | 'promptVersion'
    | 'policyVersion'
    | 'toolsetVersion'
    | 'materialManifestVersion'
  > {
    return {
      mode: run.mode,
      modelRef: run.modelRef,
      budget: run.budget,
      promptVersion: run.promptVersion,
      policyVersion: run.policyVersion,
      toolsetVersion: run.toolsetVersion,
      materialManifestVersion: run.materialManifestVersion,
    };
  }
}
