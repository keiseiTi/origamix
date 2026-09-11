import { Agent, type AgentTool } from '@earendil-works/pi-agent-core';
import type { Model, StreamFunction } from '@earendil-works/pi-ai';
import type { SimpleStreamOptions } from '@earendil-works/pi-ai';
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
  if (aborted) return new AgentEngineError('CANCELLED', '模型请求已取消');
  if (error instanceof AgentEngineError) return error;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('rate') || message.includes('429')) {
    return new AgentEngineError('RATE_LIMITED', '模型服务当前繁忙，请稍后重试', true);
  }
  return new AgentEngineError('PROVIDER_ERROR', '模型服务调用失败', true);
};

const adaptTool = (tool: AgentEngineTool): AgentTool => {
  return {
    name: tool.name,
    label: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    execute: async (_toolCallId, input, signal) => {
      const result = await tool.execute(input, signal ?? new AbortController().signal);
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
    const definition = getAgentModel(request.modelId);
    requireModelCapability(definition, 'streaming');
    requireModelCapability(definition, 'abort');
    if (request.tools?.length) requireModelCapability(definition, 'tools');
    const model = this.options.resolveModel(definition.provider, definition.model);
    if (!model) throw new AgentEngineError('MODEL_NOT_FOUND', '所选模型不可用');
    const credential = await this.options.getCredential(definition.provider);
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
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    const agent = new Agent({
      initialState: {
        systemPrompt: request.systemPrompt,
        model,
        tools: request.tools?.map(adaptTool),
      },
      streamFn: this.options.stream,
      getApiKey: async (provider) =>
        provider === definition.provider ? credential : this.options.getCredential(provider),
      toolExecution: 'sequential',
    });
    const unsubscribe = agent.subscribe(async (event) => {
      if (controller.signal.aborted) agent.abort();
      if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
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
          result: event.result?.details ?? event.result,
          isError: event.isError,
        });
      } else if (event.type === 'message_end' && event.message.role === 'assistant') {
        const piUsage = event.message.usage;
        usage = {
          inputTokens: piUsage.input,
          outputTokens: piUsage.output,
          totalTokens: piUsage.totalTokens,
        };
        if (event.message.stopReason === 'error') throw new Error(event.message.errorMessage);
      }
    });

    const abortListener = () => agent.abort();
    controller.signal.addEventListener('abort', abortListener, { once: true });
    try {
      await agent.prompt(request.prompt);
      if (controller.signal.aborted) throw controller.signal.reason;
      const result = { text, usage };
      await emit({ type: 'completed', ...result });
      return result;
    } catch (error) {
      const normalized = normalizeError(error, timedOut, controller.signal.aborted && !timedOut);
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
    }
  }
}
