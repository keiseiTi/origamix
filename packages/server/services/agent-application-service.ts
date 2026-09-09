import type { CreateAgentRunRequest } from '@origamix/shared/protocol/agent';
import type { AgentEventBroker } from '../agent/agent-event-broker';
import type { AgentRunOrchestrator } from '../agent/agent-orchestrator';
import type { AgentRunRepository, AgentRunRecord } from '../repositories/agent-run-repository';
import type { AgentRunService } from './agent-run-service';
import type { ConversationService } from './conversation-service';
import { conflict } from '../errors';

export function agentRequestText(request: CreateAgentRunRequest): string {
  return request.content.blocks
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

export class AgentApplicationService {
  constructor(
    private readonly dependencies: {
      conversations: ConversationService;
      runs: AgentRunRepository;
      runService: AgentRunService;
      events: AgentEventBroker;
      orchestrator: AgentRunOrchestrator;
      getCurrentRevision: (projectId: string, pageId: string) => string | Promise<string>;
    },
  ) {}

  async start(request: CreateAgentRunRequest): Promise<{
    run: AgentRunRecord;
    conversationId: string;
    userMessageId: string;
  }> {
    const duplicate = this.dependencies.runs.findByClientRequest(
      request.projectId,
      request.pageId,
      request.clientRequestId,
    );
    if (
      !duplicate &&
      (await this.dependencies.getCurrentRevision(request.projectId, request.pageId)) !==
        request.baseRevisionId
    ) {
      throw conflict('页面版本已变化，请刷新后重试');
    }
    const message = agentRequestText(request);
    const intent = await this.dependencies.orchestrator.route(message, request.pageId);
    const input = {
      projectId: request.projectId,
      pageId: request.pageId,
      clientRequestId: request.clientRequestId,
      baseRevisionId: request.baseRevisionId,
      message,
      ...(request.conversationId ? { conversationId: request.conversationId } : {}),
      ...(request.retryOfRunId ? { retryOfRunId: request.retryOfRunId } : {}),
    };
    const prepared = this.dependencies.orchestrator.prepareRunInput(input, intent);
    const started = this.dependencies.conversations.startRun({
      ...prepared,
      content: request.content,
    });
    if (started.created) {
      this.dependencies.events.publish({
        type: 'run.queued',
        runId: started.run.id,
        pageId: started.run.pageId,
        requestId: started.run.clientRequestId,
        payload: { status: started.run.status },
      });
    }
    if (started.created && started.run.status === 'queued') {
      queueMicrotask(() => {
        void this.dependencies.orchestrator
          .executePrepared(input, intent, started)
          .then((result) => {
            this.dependencies.events.publish({
              type: `run.${result.status}`,
              runId: result.runId,
              pageId: request.pageId,
              requestId: request.clientRequestId,
              ...(result.resultRevisionId ? { revisionId: result.resultRevisionId } : {}),
              payload: { status: result.status },
            });
          })
          .catch((error: unknown) => {
            this.dependencies.events.publish({
              type: 'run.failed',
              runId: started.run.id,
              pageId: request.pageId,
              requestId: request.clientRequestId,
              payload: {
                status: 'failed',
                safeMessage: error instanceof Error ? error.message : 'Agent 运行失败',
              },
            });
          });
      });
    }
    return {
      run: started.run,
      conversationId: started.conversation.id,
      userMessageId: started.message.messageId,
    };
  }

  get(runId: string): AgentRunRecord {
    return this.dependencies.runService.get(runId);
  }

  cancel(runId: string, requestId: string): AgentRunRecord {
    this.dependencies.orchestrator.cancel(runId);
    const run = this.dependencies.runService.get(runId);
    const terminal = ['completed', 'failed', 'cancelled', 'interrupted'].includes(run.status);
    this.dependencies.events.publish({
      type: terminal ? `run.${run.status}` : 'run.cancelling',
      runId,
      pageId: run.pageId,
      requestId,
      ...(run.resultRevisionId ? { revisionId: run.resultRevisionId } : {}),
      payload: { status: run.status },
    });
    return run;
  }
}
