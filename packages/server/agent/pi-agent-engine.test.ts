import { Type } from '@sinclair/typebox';
import { createModels } from '@earendil-works/pi-ai';
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it } from 'vitest';
import { MVP_MODEL_ID, type AgentEngineEvent } from './agent-engine';
import { PiAgentEngine } from './pi-agent-engine';

function setup(responses: ReturnType<typeof fauxAssistantMessage>[], tokensPerSecond = 10_000) {
  const faux = fauxProvider({ provider: 'deepseek', tokensPerSecond });
  faux.setResponses(responses);
  const models = createModels();
  models.setProvider(faux.provider);
  let credentialReads = 0;
  const engine = new PiAgentEngine({
    resolveModel: () => faux.getModel(),
    stream: models.streamSimple.bind(models),
    getCredential: async () => {
      credentialReads += 1;
      return 'test-only-secret';
    },
  });
  return { engine, getCredentialReads: () => credentialReads };
}

describe('PiAgentEngine', () => {
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
      engine.run({ modelId: MVP_MODEL_ID, systemPrompt: 'test', prompt: 'ping' }),
    ).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
      message: '请先在设置中配置 DeepSeek API Key',
    });
  });

  it('maps text stream, usage, and completion to product events', async () => {
    const { engine, getCredentialReads } = setup([fauxAssistantMessage('hello')]);
    const events: AgentEngineEvent[] = [];
    const result = await engine.run({
      modelId: MVP_MODEL_ID,
      systemPrompt: 'test',
      prompt: 'ping',
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(result.text).toBe('hello');
    expect(events.some((event) => event.type === 'text_delta')).toBe(true);
    expect(events.at(-1)?.type).toBe('completed');
    expect(getCredentialReads()).toBe(1);
  });

  it('executes tools sequentially and exposes normalized tool events', async () => {
    const { engine } = setup([
      fauxAssistantMessage(fauxToolCall('lookup', { id: 7 }), { stopReason: 'toolUse' }),
      fauxAssistantMessage('done'),
    ]);
    const events: AgentEngineEvent[] = [];
    const result = await engine.run({
      modelId: MVP_MODEL_ID,
      systemPrompt: 'test',
      prompt: 'use tool',
      tools: [
        {
          name: 'lookup',
          description: 'lookup',
          parameters: Type.Object({ id: Type.Number() }),
          execute: async (input) => ({ received: input }),
        },
      ],
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(result.text).toBe('done');
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(['tool_start', 'tool_end', 'completed']),
    );
  });

  it('normalizes provider errors without exposing provider details', async () => {
    const { engine } = setup([
      fauxAssistantMessage('', { stopReason: 'error', errorMessage: 'private upstream detail' }),
    ]);
    await expect(
      engine.run({ modelId: MVP_MODEL_ID, systemPrompt: 'test', prompt: 'ping' }),
    ).rejects.toMatchObject({ code: 'PROVIDER_ERROR', message: '模型服务调用失败' });
  });

  it('maps rate limits and keeps tool failures inside normalized tool events', async () => {
    const limited = setup([
      fauxAssistantMessage('', { stopReason: 'error', errorMessage: '429 private quota detail' }),
    ]);
    await expect(
      limited.engine.run({ modelId: MVP_MODEL_ID, systemPrompt: 'test', prompt: 'ping' }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', message: '模型服务当前繁忙，请稍后重试' });

    const toolFailure = setup([
      fauxAssistantMessage(fauxToolCall('fail_safely', {}), { stopReason: 'toolUse' }),
      fauxAssistantMessage('recovered'),
    ]);
    const events: AgentEngineEvent[] = [];
    const result = await toolFailure.engine.run({
      modelId: MVP_MODEL_ID,
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
  });

  it('settles as cancelled when aborted', async () => {
    const { engine } = setup([fauxAssistantMessage('a long answer')], 1);
    const controller = new AbortController();
    const pending = engine.run({
      modelId: MVP_MODEL_ID,
      systemPrompt: 'test',
      prompt: 'ping',
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('maps timeouts and awaited listener failures', async () => {
    const slow = setup([fauxAssistantMessage('slow')], 1);
    await expect(
      slow.engine.run({
        modelId: MVP_MODEL_ID,
        systemPrompt: 'test',
        prompt: 'ping',
        timeoutMs: 1,
      }),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });

    const listener = setup([fauxAssistantMessage('hello')]);
    await expect(
      listener.engine.run({
        modelId: MVP_MODEL_ID,
        systemPrompt: 'test',
        prompt: 'ping',
        onEvent: () => {
          throw new Error('listener detail');
        },
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_ERROR', message: '模型服务调用失败' });
  });
});
