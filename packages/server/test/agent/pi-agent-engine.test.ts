import { Type } from '@sinclair/typebox';
import { createModels } from '@earendil-works/pi-ai';
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it, vi } from 'vitest';
import { RunBudgetController } from '@/agent/tools/registry';
import { DEFAULT_AGENT_RUN_BUDGET } from '@/agent/run-budget';
import { DEEPSEEK_FLASH_MODEL_ID, type AgentEngineEvent } from '@/agent/agent-engine';
import { PiAgentEngine } from '@/agent/pi-agent-engine';

const setup = (responses: ReturnType<typeof fauxAssistantMessage>[], tokensPerSecond = 10_000) => {
  const faux = fauxProvider({ provider: 'deepseek', tokensPerSecond });
  faux.setResponses(responses);
  const models = createModels();
  models.setProvider(faux.provider);
  const stream = vi.fn(models.streamSimple.bind(models));
  const engine = new PiAgentEngine({
    resolveModel: () => faux.getModel(),
    stream,
    getCredential: async () => 'test-only-secret',
  });
  return { engine, stream };
};

describe('PiAgentEngine', () => {
  it('leaves room for submission and repair after more than ten discovery turns', async () => {
    const { engine, stream } = setup([
      ...Array.from({ length: 11 }, () =>
        fauxAssistantMessage(fauxToolCall('lookup', {}), { stopReason: 'toolUse' }),
      ),
      fauxAssistantMessage(fauxToolCall('complete_page_run', { valid: false }), {
        stopReason: 'toolUse',
      }),
      fauxAssistantMessage(fauxToolCall('complete_page_run', { valid: true }), {
        stopReason: 'toolUse',
      }),
    ]);
    const tracker = new RunBudgetController(DEFAULT_AGENT_RUN_BUDGET);
    let committed = false;
    await expect(
      engine.run({
        modelId: DEEPSEEK_FLASH_MODEL_ID,
        systemPrompt: 'test',
        prompt: '生成患者表单和表格',
        budget: tracker,
        tools: [
          {
            name: 'lookup',
            description: 'read',
            parameters: Type.Object({}),
            execute: async () => ({ read: true }),
          },
          {
            name: 'complete_page_run',
            description: 'submit',
            parameters: Type.Object({ valid: Type.Boolean() }),
            execute: async (input) => {
              if (!(input as { valid: boolean }).valid) throw new Error('请修正参数后重交');
              committed = true;
              return { accepted: true };
            },
          },
        ],
      }),
    ).resolves.toMatchObject({ budgetTracked: true });
    expect(committed).toBe(true);
    expect(stream).toHaveBeenCalledTimes(13);
    expect(tracker.snapshot().modelCalls).toBe(13);
    for (const [index, call] of stream.mock.calls.entries()) {
      const hints = call[1].messages.filter(
        (message) =>
          message.role === 'system' &&
          typeof message.content === 'string' &&
          message.content.startsWith('本 Run 剩余模型请求'),
      );
      expect(hints).toHaveLength(1);
      expect(hints[0]?.content).toContain(
        `剩余模型请求 ${DEFAULT_AGENT_RUN_BUDGET.maxModelCalls - index} 次`,
      );
    }
  });

  // The controller's small synthetic inputs cannot catch SDK details being counted
  // twice and blocking a page edit after otherwise valid material reads.
  it.each([
    { resultBytes: 63_000, accepted: true },
    { resultBytes: 260_000, accepted: false },
  ])(
    'enforces input budgets across material reads ($resultBytes bytes)',
    async ({ resultBytes, accepted }) => {
      const { engine, stream } = setup([
        fauxAssistantMessage(fauxToolCall('lookup', {}), { stopReason: 'toolUse' }),
        fauxAssistantMessage(fauxToolCall('lookup', {}), { stopReason: 'toolUse' }),
        fauxAssistantMessage(fauxToolCall('complete_page_run', {}), { stopReason: 'toolUse' }),
      ]);
      const tracker = new RunBudgetController(DEFAULT_AGENT_RUN_BUDGET);
      const complete = vi.fn(async () => ({ accepted: true }));
      const content = '患者姓名，性别，出生日期'
        .repeat(Math.ceil(resultBytes / 36))
        .slice(0, Math.floor(resultBytes / 3));
      const estimates: number[] = [];
      const pending = engine.run({
        modelId: DEEPSEEK_FLASH_MODEL_ID,
        systemPrompt: '生成患者表单和表格，保留完整物料定义。',
        prompt: '表单和表格包含姓名、性别和出生日期。',
        budget: {
          beforeRequest: (size, window, output) => {
            estimates.push(size);
            return tracker.beforeRequest(size, window, output);
          },
          recordUsage: (usage) => tracker.recordUsage(usage),
        },
        tools: [
          {
            name: 'lookup',
            description: 'read material',
            parameters: Type.Object({}),
            execute: async () => ({ content }),
          },
          {
            name: 'complete_page_run',
            description: 'submit page edit',
            parameters: Type.Object({}),
            execute: complete,
          },
        ],
      });
      if (accepted) {
        await expect(pending).resolves.toMatchObject({ budgetTracked: true });
        expect(complete).toHaveBeenCalledTimes(1);
        expect(stream).toHaveBeenCalledTimes(3);
        expect(estimates[2]).toBeGreaterThan(63_000);
        expect(estimates[2]).toBeLessThan(128_000);
        const reads = stream.mock.calls[2]![1].messages.filter(
          (message) => message.role === 'toolResult',
        );
        expect(reads).toHaveLength(2);
        for (const read of reads) {
          expect(read.content).toEqual([{ type: 'text', text: JSON.stringify({ content }) }]);
        }
      } else {
        await expect(pending).rejects.toMatchObject({
          code: 'BUDGET_EXCEEDED',
          message: '单次输入 Token 预估已超过本次运行预算',
        });
        expect(complete).not.toHaveBeenCalled();
        expect(stream).toHaveBeenCalledTimes(1);
      }
    },
  );

  it('counts real provider turns and stops before another request when the Run budget is exhausted', async () => {
    const { engine, stream } = setup([
      fauxAssistantMessage(fauxToolCall('lookup', {}), { stopReason: 'toolUse' }),
      fauxAssistantMessage('must not request this turn'),
    ]);
    const tracker = new RunBudgetController({ ...DEFAULT_AGENT_RUN_BUDGET, maxModelCalls: 1 });
    await expect(
      engine.run({
        modelId: DEEPSEEK_FLASH_MODEL_ID,
        systemPrompt: 'test',
        prompt: 'read',
        budget: {
          remainingModelCalls: () => tracker.remainingModelCalls(),
          beforeRequest: (size, window, output) => tracker.beforeRequest(size, window, output),
          recordUsage: (usage) => tracker.recordUsage(usage),
        },
        tools: [
          {
            name: 'lookup',
            description: 'read',
            parameters: Type.Object({}),
            execute: async () => ({ value: 'read' }),
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'BUDGET_EXCEEDED' });
    expect(stream).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(stream.mock.calls[0]?.[1].messages)).toContain(
      '已进入提交与修复预留轮次',
    );
    expect(stream.mock.calls[0]?.[2]).toMatchObject({
      maxRetries: 0,
      maxTokens: expect.any(Number),
    });
    expect(tracker.snapshot().inputTokens).toBeGreaterThan(0);
    expect(tracker.snapshot().outputTokens).toBeGreaterThan(0);
  });

  it('aborts a fatal tool budget error instead of letting the SDK request a repair turn', async () => {
    const { engine, stream } = setup([
      fauxAssistantMessage(fauxToolCall('lookup', {}), { stopReason: 'toolUse' }),
      fauxAssistantMessage('must not continue'),
    ]);
    const tracker = new RunBudgetController({ ...DEFAULT_AGENT_RUN_BUDGET, maxToolCalls: 1 });
    tracker.consumeToolCall();
    await expect(
      engine.run({
        modelId: DEEPSEEK_FLASH_MODEL_ID,
        systemPrompt: 'test',
        prompt: 'read',
        tools: [
          {
            name: 'lookup',
            description: 'read',
            parameters: Type.Object({}),
            execute: async () => {
              tracker.consumeToolCall();
              return {};
            },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'BUDGET_EXCEEDED' });
    expect(stream).toHaveBeenCalledTimes(1);
  });
  it('requires a configured provider credential instead of falling back to a fake model', async () => {
    const faux = fauxProvider({ provider: 'deepseek' });
    const models = createModels();
    models.setProvider(faux.provider);
    const engine = new PiAgentEngine({
      resolveModel: () => faux.getModel(),
      stream: models.streamSimple.bind(models),
      getCredential: async () => undefined,
    });
    await expect(
      engine.run({ modelId: DEEPSEEK_FLASH_MODEL_ID, systemPrompt: 'test', prompt: 'ping' }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
      message: '请先在设置中配置模型 API Key',
    });
  });

  it('executes tools sequentially and exposes normalized tool events', async () => {
    const { engine } = setup([
      fauxAssistantMessage(fauxToolCall('lookup', { id: 7 }), { stopReason: 'toolUse' }),
      fauxAssistantMessage('done'),
    ]);
    const events: AgentEngineEvent[] = [];
    const turns: { inputTokens: number; outputTokens: number; totalTokens: number }[] = [];
    const result = await engine.run({
      modelId: DEEPSEEK_FLASH_MODEL_ID,
      systemPrompt: 'test',
      prompt: 'use tool',
      budget: {
        beforeRequest: () => 8192,
        recordUsage: (usage) => {
          turns.push(usage);
        },
      },
      tools: [
        {
          name: 'lookup',
          description: 'lookup',
          parameters: Type.Object({ id: Type.Number() }),
          execute: async (input) => ({ received: input }),
        },
      ],
      onEvent: async (event) => {
        if (event.type === 'tool_end') await new Promise((resolve) => setTimeout(resolve, 5));
        events.push(event);
      },
    });

    expect(result.text).toBe('done');
    expect(events).toContainEqual(expect.objectContaining({ type: 'text_delta' }));
    expect(turns).toHaveLength(2);
    const metrics = events.filter((event) => event.type === 'model_usage');
    expect(metrics).toHaveLength(2);
    expect(metrics[1]?.metrics.toolResultBytes).toBeGreaterThan(0);
    expect(metrics[0]?.metrics.toolDefinitionBytes).toBeGreaterThan(0);
    expect(JSON.stringify(metrics)).not.toContain('test-only-secret');
    expect(JSON.stringify(metrics)).not.toContain('received');
    expect(metrics.map((event) => event.metrics.inputTokens)).toEqual(
      turns.map((turn) => turn.inputTokens),
    );
    expect(result.usage.inputTokens).toBe(turns.reduce((sum, turn) => sum + turn.inputTokens, 0));
    expect(result.usage.outputTokens).toBe(turns.reduce((sum, turn) => sum + turn.outputTokens, 0));
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['tool_start', 'tool_end', 'completed']),
    );
    expect(events.findIndex((event) => event.type === 'tool_end')).toBeLessThan(
      events.findIndex((event) => event.type === 'completed'),
    );
  });

  it.each(['complete_page_run'])(
    'ends after an accepted %s decision without another provider request',
    async (terminalTool) => {
      const { engine } = setup([
        fauxAssistantMessage(fauxToolCall(terminalTool, {}), { stopReason: 'toolUse' }),
        fauxAssistantMessage('unexpected extra turn'),
      ]);
      let decisions = 0;
      const events: AgentEngineEvent[] = [];
      const result = await engine.run({
        modelId: DEEPSEEK_FLASH_MODEL_ID,
        systemPrompt: 'test',
        prompt: 'complete the page request',
        tools: [
          {
            name: terminalTool,
            description: 'complete page request',
            parameters: Type.Object({}),
            execute: async () => {
              decisions += 1;
              return { accepted: true };
            },
          },
        ],
        onEvent: (event) => {
          events.push(event);
        },
      });

      expect(decisions).toBe(1);
      expect(result.text).toBe('');
      expect(events).toContainEqual(expect.objectContaining({ type: 'tool_end', isError: false }));
      expect(events.at(-1)?.type).toBe('completed');
    },
  );

  it('normalizes provider errors without exposing provider details', async () => {
    const { engine } = setup([
      fauxAssistantMessage('', { stopReason: 'error', errorMessage: 'private upstream detail' }),
    ]);
    await expect(
      engine.run({ modelId: DEEPSEEK_FLASH_MODEL_ID, systemPrompt: 'test', prompt: 'ping' }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
      message: '模型服务暂时不可用，请稍后重试',
    });

    const invalidRequest = setup([
      fauxAssistantMessage('', {
        stopReason: 'error',
        errorMessage: '400 invalid_request_error: private schema detail',
      }),
    ]);
    await expect(
      invalidRequest.engine.run({
        modelId: DEEPSEEK_FLASH_MODEL_ID,
        systemPrompt: 'test',
        prompt: 'ping',
      }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
      message: '模型供应商拒绝了 Agent 请求参数，请检查模型与工具协议兼容性',
      retryable: false,
    });
  });

  it('maps rate limits and keeps tool failures inside normalized tool events', async () => {
    const limited = setup([
      fauxAssistantMessage('', { stopReason: 'error', errorMessage: '429 private quota detail' }),
    ]);
    await expect(
      limited.engine.run({
        modelId: DEEPSEEK_FLASH_MODEL_ID,
        systemPrompt: 'test',
        prompt: 'ping',
      }),
    ).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      message: '请求过于频繁或额度不足，请稍后重试',
    });

    const toolFailure = setup([
      fauxAssistantMessage(fauxToolCall('fail_safely', {}), { stopReason: 'toolUse' }),
      fauxAssistantMessage('recovered'),
    ]);
    const events: AgentEngineEvent[] = [];
    const result = await toolFailure.engine.run({
      modelId: DEEPSEEK_FLASH_MODEL_ID,
      systemPrompt: 'test',
      prompt: 'use tool',
      tools: [
        {
          name: 'fail_safely',
          description: 'test failure',
          parameters: Type.Object({}),
          execute: async () => {
            throw new Error('private tool failure');
          },
        },
      ],
      onEvent: (event) => {
        events.push(event);
      },
    });
    expect(result.text).toBe('recovered');
    expect(events).toContainEqual(expect.objectContaining({ type: 'tool_end', isError: true }));
    expect(events.find((event) => event.type === 'tool_end' && event.isError)).toMatchObject({
      result: { content: [{ type: 'text', text: 'private tool failure' }] },
    });
  });

  it('settles as cancelled when aborted', async () => {
    const { engine } = setup([fauxAssistantMessage('a long answer')], 1);
    const controller = new AbortController();
    const pending = engine.run({
      modelId: DEEPSEEK_FLASH_MODEL_ID,
      systemPrompt: 'test',
      prompt: 'ping',
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('terminates a provider request when the Run timeout is reached', async () => {
    const slow = setup([fauxAssistantMessage('slow')], 1);
    await expect(
      slow.engine.run({
        modelId: DEEPSEEK_FLASH_MODEL_ID,
        systemPrompt: 'test',
        prompt: 'ping',
        timeoutMs: 1,
      }),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});
