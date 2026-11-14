import { Agent, type AgentTool } from '@earendil-works/pi-agent-core';
import type { Model, StreamFunction } from '@earendil-works/pi-ai';
import type { SimpleStreamOptions } from '@earendil-works/pi-ai';
import { normalizeContext } from '@earendil-works/pi-ai';
import { measureInputContext } from './input-token-estimate';
import { createHash } from 'node:crypto';
import {
  AgentEngineError,
  getAgentModel,
  requireModelCapability,
  type AgentEngine,
  type AgentEngineEvent,
  type AgentEngineRequest,
  type AgentEngineResult,
  type AgentEngineTool,
} from './agent-engine';

type PiStream = StreamFunction<string, SimpleStreamOptions>;

export interface PiAgentEngineOptions {
  resolveModel: (provider: string, model: string) => Model<string> | undefined;
  stream: PiStream;
  getCredential: (provider: string) => Promise<string | undefined>;
}

const normalizeError = (error: unknown, timedOut: boolean, aborted: boolean): AgentEngineError => {
  if (timedOut) return new AgentEngineError('TIMEOUT', '模型请求超时', true);
  if (error instanceof AgentEngineError) return error;
  if (aborted) return new AgentEngineError('CANCELLED', '模型请求已取消');
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('rate') || message.includes('429')) {
    return new AgentEngineError('RATE_LIMITED', '请求过于频繁或额度不足，请稍后重试', true);
  }
  if (
    message.includes('401') ||
    message.includes('403') ||
    message.includes('unauthorized') ||
    message.includes('authentication') ||
    message.includes('invalid api key')
  ) {
    return new AgentEngineError('PROVIDER_ERROR', 'DeepSeek API Key 无效或已失效');
  }
  if (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('econn') ||
    message.includes('enotfound') ||
    message.includes('socket') ||
    message.includes('connection')
  ) {
    return new AgentEngineError('PROVIDER_ERROR', '无法连接 DeepSeek，请检查网络后重试', true);
  }
  if (
    message.includes('400') ||
    message.includes('bad request') ||
    message.includes('invalid_request_error') ||
    (message.includes('invalid') && message.includes('schema'))
  ) {
    return new AgentEngineError(
      'PROVIDER_ERROR',
      'DeepSeek 拒绝了 Agent 请求参数，请检查模型与工具协议兼容性',
    );
  }
  return new AgentEngineError('PROVIDER_ERROR', 'DeepSeek 服务暂时不可用，请稍后重试', true);
};

const adaptTool = (
  tool: AgentEngineTool,
  onTerminalDecision: () => void,
  onFatal: (error: AgentEngineError) => void,
): AgentTool => {
  return {
    name: tool.name,
    label: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    execute: async (_toolCallId, input, signal) => {
      let result: unknown;
      try {
        result = await tool.execute(input, signal ?? new AbortController().signal);
      } catch (error) {
        if (error instanceof AgentEngineError && error.code === 'BUDGET_EXCEEDED') onFatal(error);
        throw error;
      }
      if (['complete_page_run', 'complete_project_settings'].includes(tool.name))
        onTerminalDecision();
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        details: result,
      };
    },
  };
};

export class PiAgentEngine implements AgentEngine {
  constructor(private readonly options: PiAgentEngineOptions) {}

  async run(request: AgentEngineRequest): Promise<AgentEngineResult> {
    if (request.signal?.aborted)
      throw request.signal.reason instanceof AgentEngineError
        ? request.signal.reason
        : new AgentEngineError('CANCELLED', '模型请求已取消');
    const definition = getAgentModel(request.modelId);
    requireModelCapability(definition, 'streaming');
    requireModelCapability(definition, 'abort');
    if (request.tools?.length) requireModelCapability(definition, 'tools');
    const model = this.options.resolveModel(definition.provider, definition.model);
    if (!model) throw new AgentEngineError('MODEL_NOT_FOUND', '所选模型不可用');
    const credential = await this.options.getCredential(definition.provider);
    if (request.signal?.aborted)
      throw request.signal.reason instanceof AgentEngineError
        ? request.signal.reason
        : new AgentEngineError('CANCELLED', '模型请求已取消');
    if (!credential)
      throw new AgentEngineError('PROVIDER_ERROR', '请先在设置中配置 DeepSeek API Key');

    const controller = new AbortController();
    let timedOut = false;
    const forwardAbort = () => controller.abort(request.signal?.reason);
    if (request.signal?.aborted) forwardAbort();
    else request.signal?.addEventListener('abort', forwardAbort, { once: true });
    const timer = request.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, request.timeoutMs)
      : undefined;
    const emit = async (event: AgentEngineEvent) => request.onEvent?.(event);
    let text = '';
    const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let terminalDecisionCompleted = false;
    let fatalBudgetError: AgentEngineError | undefined;
    let outputCap = 16_000;
    let inputReservation = 0;
    let streamedBytes = 0;
    let inputMetrics: ReturnType<typeof measureInputContext> | undefined;
    let requestStartedAt = 0;
    const seenToolCalls = new Set<string>();
    const onFatal = (error: AgentEngineError) => {
      fatalBudgetError ??= error;
      controller.abort(error);
    };

    const agent = new Agent({
      initialState: {
        systemPrompt: request.systemPrompt,
        model,
        tools: request.tools?.map((tool) =>
          adaptTool(
            tool,
            () => {
              terminalDecisionCompleted = true;
            },
            onFatal,
          ),
        ),
      },
      streamFn: (currentModel, context, options) => {
        try {
          if (fatalBudgetError) throw fatalBudgetError;
          if (controller.signal.aborted) throw new AgentEngineError('CANCELLED', '模型请求已取消');
          const remainingCalls = request.budget?.remainingModelCalls?.();
          // Inject a fresh hint for this request only, without accumulating stale
          // countdowns in the conversation or discarding exact tool read results.
          const requestContext =
            remainingCalls === undefined
              ? context
              : normalizeContext({
                  ...context,
                  messages: [
                    ...context.messages,
                    {
                      role: 'system',
                      content: `本 Run 剩余模型请求 ${remainingCalls} 次（包含当前响应），不是工具调用次数。独立且参数已知的只读工具请在同一响应中一起调用；分页或依赖前次结果的读取仍须等待结果。复用已读能力，不重复读取相同内容。至少预留 3 次模型请求用于终态提交及校验修复。${remainingCalls <= 3 ? '已进入提交与修复预留轮次：优先使用已核实的信息完成终态提交，避免无关读取和重复预检。' : ''}缺少必要信息时使用终态工具澄清，不得猜测字段或跳过校验，也不得在终态提交成功前声称修改完成。`,
                      timestamp: Date.now(),
                    },
                  ],
                });
          inputMetrics = measureInputContext(requestContext);
          inputReservation = inputMetrics.estimatedInputTokens;
          outputCap =
            request.budget?.beforeRequest(
              inputReservation,
              currentModel.contextWindow,
              currentModel.maxTokens,
            ) ?? Math.min(16_000, currentModel.maxTokens);
          streamedBytes = 0;
          requestStartedAt = Date.now();
          return this.options.stream(currentModel, requestContext, {
            ...options,
            signal: controller.signal,
            maxRetries: 0,
            maxTokens: Math.min(options?.maxTokens ?? outputCap, outputCap),
          });
        } catch (error) {
          if (error instanceof AgentEngineError && error.code === 'BUDGET_EXCEEDED') onFatal(error);
          throw error;
        }
      },
      getApiKey: async (provider) =>
        provider === definition.provider ? credential : this.options.getCredential(provider),
      toolExecution: 'sequential',
      beforeToolCall: async ({ assistantMessage }) => {
        if (fatalBudgetError) throw fatalBudgetError;
        if (controller.signal.aborted) throw new AgentEngineError('CANCELLED', '模型请求已取消');
        const writeCalls = assistantMessage.content.filter(
          (entry) =>
            entry.type === 'toolCall' &&
            ['complete_page_run', 'complete_project_settings'].includes(entry.name),
        );
        if (writeCalls.length > 1) {
          return {
            block: true,
            reason: '一次页面请求只能提交一个终态，请合并完整结果后重试。',
          };
        }
        return undefined;
      },
      finishTurn: ({ message }) => {
        if (message.stopReason === 'error' || message.stopReason === 'aborted') return;
        return terminalDecisionCompleted ? { action: 'end' } : undefined;
      },
    });
    let eventProcessingError: unknown;
    let eventQueue = Promise.resolve();
    const unsubscribe = agent.subscribe((event) => {
      eventQueue = eventQueue.then(async () => {
        try {
          if (controller.signal.aborted) agent.abort();
          if (event.type === 'message_update') {
            const delta = event.assistantMessageEvent;
            if ('delta' in delta && typeof delta.delta === 'string')
              streamedBytes += Buffer.byteLength(delta.delta, 'utf8');
            if (streamedBytes > outputCap * 4 + 4096)
              throw new AgentEngineError('BUDGET_EXCEEDED', '模型流式输出体积超过安全预算');
          }
          if (
            event.type === 'message_update' &&
            event.assistantMessageEvent.type === 'text_delta'
          ) {
            text += event.assistantMessageEvent.delta;
            await emit({ type: 'text_delta', delta: event.assistantMessageEvent.delta });
          } else if (event.type === 'tool_execution_start') {
            await emit({
              type: 'tool_start',
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              input: event.args,
            });
          } else if (event.type === 'tool_execution_end') {
            await emit({
              type: 'tool_end',
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              result: event.isError ? event.result : (event.result?.details ?? event.result),
              isError: event.isError,
            });
          } else if (event.type === 'message_end' && event.message.role === 'assistant') {
            const piUsage = event.message.usage;
            const turnUsage = {
              inputTokens:
                piUsage.input + piUsage.cacheRead + piUsage.cacheWrite || inputReservation,
              outputTokens:
                piUsage.output || Buffer.byteLength(JSON.stringify(event.message.content), 'utf8'),
              totalTokens: 0,
            };
            turnUsage.totalTokens = turnUsage.inputTokens + turnUsage.outputTokens;
            usage.inputTokens += turnUsage.inputTokens;
            usage.outputTokens += turnUsage.outputTokens;
            usage.totalTokens += turnUsage.totalTokens;
            const calls = event.message.content.filter((entry) => entry.type === 'toolCall');
            let repeatedToolCalls = 0;
            for (const call of calls) {
              const key = createHash('sha256')
                .update(JSON.stringify([call.name, call.arguments]))
                .digest('hex');
              if (seenToolCalls.has(key)) repeatedToolCalls += 1;
              seenToolCalls.add(key);
            }
            if (inputMetrics)
              await emit({
                type: 'model_usage',
                metrics: {
                  ...inputMetrics,
                  inputTokens: turnUsage.inputTokens,
                  outputTokens: turnUsage.outputTokens,
                  cacheReadTokens: piUsage.cacheRead,
                  cacheWriteTokens: piUsage.cacheWrite,
                  inputUsageEstimated: !(piUsage.input + piUsage.cacheRead + piUsage.cacheWrite),
                  outputUsageEstimated: !piUsage.output,
                  durationMs: Date.now() - requestStartedAt,
                  toolCalls: calls.length,
                  repeatedToolCalls,
                },
              });
            request.budget?.recordUsage(turnUsage);
            if (
              Buffer.byteLength(JSON.stringify(event.message.content), 'utf8') >
              outputCap * 4 + 4096
            )
              throw new AgentEngineError('BUDGET_EXCEEDED', '模型输出体积超过安全预算');

            if (event.message.stopReason === 'error') throw new Error(event.message.errorMessage);
          }
        } catch (error) {
          if (error instanceof AgentEngineError && error.code === 'BUDGET_EXCEEDED') onFatal(error);
          eventProcessingError ??= error;
        }
      });
      return eventQueue;
    });

    const abortListener = () => agent.abort();
    controller.signal.addEventListener('abort', abortListener, { once: true });
    try {
      await agent.prompt(request.prompt);
      let drainedQueue: Promise<void>;
      do {
        drainedQueue = eventQueue;
        await drainedQueue;
      } while (drainedQueue !== eventQueue);
      if (eventProcessingError) throw eventProcessingError;
      if (controller.signal.aborted) throw controller.signal.reason;
      const result = { text, usage, budgetTracked: Boolean(request.budget) };
      await emit({ type: 'completed', ...result });
      return result;
    } catch (error) {
      const reason =
        controller.signal.reason instanceof AgentEngineError ? controller.signal.reason : error;
      const normalized =
        fatalBudgetError ??
        normalizeError(reason, timedOut, controller.signal.aborted && !timedOut);
      try {
        await emit({ type: 'failed', error: normalized });
      } catch {
        // A UI/event listener must not replace the normalized run failure.
      }
      throw normalized;
    } finally {
      if (timer) clearTimeout(timer);
      request.signal?.removeEventListener('abort', forwardAbort);
      controller.signal.removeEventListener('abort', abortListener);
      unsubscribe();
      // Drain already queued callbacks before the owner can close persistence.
      await eventQueue;
    }
  }
}
