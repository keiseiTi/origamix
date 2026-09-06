import { Agent } from '@earendil-works/pi-agent-core';
import { createModels } from '@earendil-works/pi-ai';
import { fauxAssistantMessage, fauxProvider } from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it } from 'vitest';
import { createMvpPiModels, mvpModelReference } from './pi-runtime';

describe('Pi runtime compatibility', () => {
  it('resolves the pinned MVP model from Pi without reading credentials', () => {
    const { model } = createMvpPiModels();

    expect(model.provider).toBe(mvpModelReference.provider);
    expect(model.id).toBe(mvpModelReference.model);
  });

  it('runs the public Agent API and streams lifecycle events with a fake provider', async () => {
    const faux = fauxProvider({ tokensPerSecond: 10_000 });
    faux.setResponses([fauxAssistantMessage('ready')]);
    const models = createModels();
    models.setProvider(faux.provider);
    const events: string[] = [];
    const agent = new Agent({
      initialState: {
        systemPrompt: 'Only verify the local Pi runtime.',
        model: faux.getModel(),
      },
      streamFn: models.streamSimple.bind(models),
    });
    agent.subscribe((event) => {
      events.push(event.type);
    });

    await agent.prompt('ping');

    expect(events).toContain('agent_start');
    expect(events).toContain('message_update');
    expect(events.at(-1)).toBe('agent_end');
    expect(agent.state.messages.at(-1)?.role).toBe('assistant');
  });
});
