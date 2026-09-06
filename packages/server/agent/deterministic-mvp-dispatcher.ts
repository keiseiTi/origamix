import type {
  CreateAgentRunRequest,
  MessageContent,
  RunMode,
} from '@origamix/shared/protocol/agent';
import type { AgentRunService } from '../services/agent-run-service';
import type { ConversationService } from '../services/conversation-service';
import type { AgentEventBroker } from './agent-event-broker';

const textContent = (text: string): MessageContent => ({
  version: '1',
  blocks: [{ type: 'text', text }],
});
export const requestText = (request: CreateAgentRunRequest): string =>
  request.content.blocks
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

export function deterministicRunMode(text: string): RunMode {
  if (/(天气|股票|新闻|写诗|翻译|闲聊|笑话)/u.test(text)) return 'out_of_scope';
  if (/(怎么|如何|为什么|是什么|支持哪些|能否|可以吗|搭建器)/u.test(text)) return 'page_question';
  return 'page_modify';
}

/** Temporary executable closure until the real model/tool capability matrix is approved. */
export class DeterministicMvpDispatcher {
  constructor(
    private readonly dependencies: {
      conversations: ConversationService;
      runs: AgentRunService;
      events: AgentEventBroker;
    },
  ) {}

  dispatch(input: { runId: string; request: CreateAgentRunRequest }): void {
    queueMicrotask(() => this.execute(input));
  }

  private execute({ runId, request }: { runId: string; request: CreateAgentRunRequest }): void {
    const run = this.dependencies.runs.get(runId);
    if (run.status !== 'queued') return;
    this.dependencies.runs.transition(runId, 'classifying');
    this.publish(runId, request, 'run.stage', { status: 'classifying' });
    if (run.mode === 'out_of_scope') {
      this.complete(
        runId,
        request,
        '我只能协助当前低代码页面的搭建与使用问题。你可以告诉我想创建或修改的表单、表格和页面布局。',
      );
      return;
    }
    if (run.mode === 'page_question') {
      this.dependencies.runs.transition(runId, 'generating');
      this.publish(runId, request, 'run.stage', { status: 'generating' });
      this.complete(
        runId,
        request,
        '请描述目标字段、校验规则、表格列和交互行为；Agent 会基于可用物料生成并校验页面 Schema。当前真实模型与工具能力尚未启用。',
      );
      return;
    }
    this.dependencies.runs.transition(runId, 'generating');
    this.publish(runId, request, 'run.stage', { status: 'generating' });
    const reply =
      '当前尚未启用已验证的真实模型与 Schema 工具能力，因此没有修改页面。配置完成后可重试本次需求。';
    this.dependencies.conversations.failAssistant(
      runId,
      textContent(reply),
      'MODEL_NOT_CONFIGURED',
    );
    const failed = this.dependencies.runs.transition(runId, 'failed', {
      errorCode: 'MODEL_NOT_CONFIGURED',
      errorMessage: reply,
    });
    this.publish(runId, request, 'run.failed', {
      status: failed.status,
      errorCode: failed.errorCode,
    });
  }

  private complete(runId: string, request: CreateAgentRunRequest, text: string): void {
    this.dependencies.conversations.finishAssistant(runId, textContent(text));
    const completed = this.dependencies.runs.transition(runId, 'completed');
    this.publish(runId, request, 'assistant.delta', { delta: text });
    this.publish(runId, request, 'run.completed', { status: completed.status });
  }

  private publish(
    runId: string,
    request: CreateAgentRunRequest,
    type: string,
    payload: unknown,
  ): void {
    this.dependencies.events.publish({
      type,
      runId,
      pageId: request.pageId,
      requestId: request.clientRequestId,
      payload,
    });
  }
}
