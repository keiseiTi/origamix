import { createModels } from '@earendil-works/pi-ai';
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';
import { describe, expect, it } from 'vitest';
import {
  probeDeepSeekCapabilities,
  type ProbeStream,
} from '../../evaluation/model-capability-probe';

describe('DeepSeek capability probe', () => {
  it('normalizes streamed text and one structured tool call without returning content', async () => {
    const faux = fauxProvider({ tokensPerSecond: 10_000 });
    faux.setResponses([
      fauxAssistantMessage(fauxText('ready')),
      fauxAssistantMessage(fauxToolCall('set_field_label', { label: 'Customer name' })),
    ]);
    const models = createModels();
    models.setProvider(faux.provider);

    const result = await probeDeepSeekCapabilities({
      apiKey: 'fake-secret-that-must-not-leak',
      stream: ((_model, context, options) =>
        models.streamSimple(faux.getModel(), context, options)) as ProbeStream,
    });

    expect(result.textStreaming).toMatchObject({ outcome: 'completed' });
    expect(result.textStreaming.textDeltaCount).toBeGreaterThan(0);
    expect(result.structuredToolCall.toolCall).toEqual({
      name: 'set_field_label',
      argumentsAreObject: true,
    });
    expect(result.structuredToolCall.toolCallCount).toBe(1);
    expect(JSON.stringify(result)).not.toContain('fake-secret');
    expect(JSON.stringify(result)).not.toContain('Customer name');
  });

  it('normalizes provider authentication errors without exposing their text', async () => {
    const faux = fauxProvider({ tokensPerSecond: 10_000 });
    faux.setResponses([
      fauxAssistantMessage('', {
        stopReason: 'error',
        errorMessage: '401 bad api key: fake-secret',
      }),
      fauxAssistantMessage('unused'),
    ]);
    const models = createModels();
    models.setProvider(faux.provider);

    const result = await probeDeepSeekCapabilities({
      apiKey: 'fake-secret',
      stream: ((_model, context, options) =>
        models.streamSimple(faux.getModel(), context, options)) as ProbeStream,
    });

    expect(result.textStreaming.failureCode).toBe('AUTHENTICATION');
    expect(JSON.stringify(result)).not.toContain('fake-secret');
  });

  it('settles a hanging provider request on timeout', async () => {
    const stream: ProbeStream = (_model, _context, options) => {
      const faux = fauxProvider();
      faux.setResponses([
        async () =>
          await new Promise((resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(options.signal.reason), {
              once: true,
            });
          }),
      ]);
      const models = createModels();
      models.setProvider(faux.provider);
      return models.streamSimple(faux.getModel(), { messages: [] }, options);
    };

    const result = await probeDeepSeekCapabilities({ apiKey: 'fake-secret', timeoutMs: 5, stream });
    expect(result.textStreaming.failureCode).toBe('TIMEOUT');
    expect(result.structuredToolCall.failureCode).toBe('TIMEOUT');
  });

  it('settles a hanging provider request on caller cancellation', async () => {
    const controller = new AbortController();
    const stream: ProbeStream = (_model, _context, options) => {
      const faux = fauxProvider();
      faux.setResponses([
        async () =>
          await new Promise((resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(options.signal.reason), {
              once: true,
            });
          }),
      ]);
      const models = createModels();
      models.setProvider(faux.provider);
      return models.streamSimple(faux.getModel(), { messages: [] }, options);
    };
    setTimeout(() => controller.abort(), 5);

    const result = await probeDeepSeekCapabilities({
      apiKey: 'fake-secret',
      timeoutMs: 1_000,
      signal: controller.signal,
      stream,
    });
    expect(result.textStreaming.failureCode).toBe('CANCELLED');
    expect(result.structuredToolCall.failureCode).toBe('CANCELLED');
  });
});
