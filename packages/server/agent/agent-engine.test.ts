import { describe, expect, it } from 'vitest';
import {
  AgentEngineError,
  FakeAgentEngine,
  MVP_MODEL_ID,
  getAgentModel,
  requireModelCapability,
} from './agent-engine';

describe('AgentEngine contract', () => {
  it('resolves only registered models', () => {
    expect(getAgentModel(MVP_MODEL_ID).model).toBe('deepseek-v4-flash');
    expect(() => getAgentModel('unknown/model')).toThrowError(AgentEngineError);
  });

  it('rejects unsupported model capabilities', () => {
    expect(() =>
      requireModelCapability(
        {
          id: 'test/model',
          provider: 'test',
          model: 'model',
          capabilities: { streaming: true, tools: false, abort: true },
        },
        'tools',
      ),
    ).toThrowError(expect.objectContaining({ code: 'CAPABILITY_UNSUPPORTED' }));
  });

  it('supports deterministic tests without a provider', async () => {
    const engine = new FakeAgentEngine(async () => ({
      text: 'ok',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    }));
    await expect(
      engine.run({ modelId: MVP_MODEL_ID, systemPrompt: 'test', prompt: 'hello' }),
    ).resolves.toMatchObject({ text: 'ok' });
  });

  it('rejects unknown models before invoking a fake handler', async () => {
    let called = false;
    const engine = new FakeAgentEngine(async () => {
      called = true;
      return { text: '', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 } };
    });
    await expect(
      engine.run({ modelId: 'missing', systemPrompt: 'test', prompt: 'hello' }),
    ).rejects.toMatchObject({ code: 'MODEL_NOT_FOUND' });
    expect(called).toBe(false);
  });
});
