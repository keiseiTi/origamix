import type {
  AssistantMessageEventStream,
  Api,
  Context,
  Model,
  ToolCall,
} from '@earendil-works/pi-ai';
import { createMvpPiModels, mvpModelReference } from '../agent/pi-runtime';

export type ModelProbeFailureCode =
  'AUTHENTICATION' | 'RATE_LIMITED' | 'PROVIDER_ERROR' | 'TIMEOUT' | 'CANCELLED';

export interface ModelProbeObservation {
  outcome: 'completed' | 'failed';
  textDeltaCount: number;
  toolCallCount: number;
  toolCall?: { name: string; argumentsAreObject: boolean };
  failureCode?: ModelProbeFailureCode;
}

export interface DeepSeekCapabilityReport {
  provider: typeof mvpModelReference.provider;
  model: typeof mvpModelReference.model;
  textStreaming: ModelProbeObservation;
  structuredToolCall: ModelProbeObservation;
}

export type ProbeStream = (
  model: Model<Api>,
  context: Context,
  options: { apiKey: string; signal: AbortSignal; timeoutMs: number; maxRetries: number },
) => AssistantMessageEventStream;

interface ProbeOptions {
  apiKey: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  stream?: ProbeStream;
}

const textContext: Context = {
  systemPrompt: 'Return only the word ready.',
  messages: [{ role: 'user', content: 'Reply now.', timestamp: 0 }],
};

const toolContext: Context = {
  systemPrompt: 'Call the supplied tool exactly once. Do not answer with prose.',
  messages: [{ role: 'user', content: 'Set the field label to Customer name.', timestamp: 0 }],
  tools: [
    {
      name: 'set_field_label',
      description: 'Sets a form field label.',
      parameters: {
        type: 'object',
        properties: { label: { type: 'string' } },
        required: ['label'],
        additionalProperties: false,
      },
    },
  ],
};

const classifyFailure = (
  message: string,
  didTimeout: boolean,
  didCancel: boolean,
): ModelProbeFailureCode => {
  if (didTimeout) return 'TIMEOUT';
  if (didCancel) return 'CANCELLED';
  const normalized = message.toLowerCase();
  if (normalized.includes('401') || normalized.includes('auth') || normalized.includes('api key')) {
    return 'AUTHENTICATION';
  }
  if (normalized.includes('429') || normalized.includes('rate limit')) return 'RATE_LIMITED';
  return 'PROVIDER_ERROR';
};

const observeStream = async (
  stream: AssistantMessageEventStream,
  control: { didTimeout: () => boolean; didCancel: () => boolean },
): Promise<ModelProbeObservation> => {
  let textDeltaCount = 0;
  let toolCallCount = 0;
  let toolCall: ToolCall | undefined;
  try {
    for await (const event of stream) {
      if (event.type === 'text_delta') textDeltaCount += 1;
      if (event.type === 'toolcall_end') {
        toolCallCount += 1;
        toolCall = event.toolCall;
      }
      if (event.type === 'error') {
        return {
          outcome: 'failed',
          textDeltaCount,
          toolCallCount,
          failureCode: classifyFailure(
            event.error.errorMessage ?? event.reason,
            control.didTimeout(),
            control.didCancel(),
          ),
        };
      }
    }
    return {
      outcome: 'completed',
      textDeltaCount,
      toolCallCount,
      ...(toolCall
        ? {
            toolCall: {
              name: toolCall.name,
              argumentsAreObject:
                toolCall.arguments !== null &&
                typeof toolCall.arguments === 'object' &&
                !Array.isArray(toolCall.arguments),
            },
          }
        : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'provider error';
    return {
      outcome: 'failed',
      textDeltaCount,
      toolCallCount,
      failureCode: classifyFailure(message, control.didTimeout(), control.didCancel()),
    };
  }
};

const runObservation = async (
  model: Model<Api>,
  streamFn: ProbeStream,
  context: Context,
  options: Required<Pick<ProbeOptions, 'apiKey' | 'timeoutMs'>> & Pick<ProbeOptions, 'signal'>,
): Promise<ModelProbeObservation> => {
  const controller = new AbortController();
  let timedOut = false;
  let cancelled = false;
  const onCancel = () => {
    cancelled = true;
    controller.abort(options.signal?.reason);
  };
  options.signal?.addEventListener('abort', onCancel, { once: true });
  if (options.signal?.aborted) onCancel();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('model capability probe timed out'));
  }, options.timeoutMs);
  try {
    return await observeStream(
      streamFn(model, context, {
        apiKey: options.apiKey,
        signal: controller.signal,
        timeoutMs: options.timeoutMs,
        maxRetries: 0,
      }),
      { didTimeout: () => timedOut, didCancel: () => cancelled },
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onCancel);
  }
};

/**
 * Runs two narrowly-scoped provider requests and returns metadata only. The API key,
 * prompts, response text and tool arguments are deliberately absent from the report.
 */
export const probeDeepSeekCapabilities = async (
  options: ProbeOptions,
): Promise<DeepSeekCapabilityReport> => {
  if (!options.apiKey.trim()) throw new Error('DeepSeek API Key is required');
  const { model, models } = createMvpPiModels();
  const streamFn = options.stream ?? (models.streamSimple.bind(models) as ProbeStream);
  const requestOptions = {
    apiKey: options.apiKey,
    timeoutMs: options.timeoutMs ?? 15_000,
    signal: options.signal,
  };
  const textStreaming = await runObservation(model, streamFn, textContext, requestOptions);
  if (textStreaming.outcome === 'failed') {
    return {
      ...mvpModelReference,
      textStreaming,
      structuredToolCall: {
        outcome: 'failed',
        textDeltaCount: 0,
        toolCallCount: 0,
        failureCode: textStreaming.failureCode,
      },
    };
  }
  const structuredToolCall = await runObservation(model, streamFn, toolContext, requestOptions);
  return { ...mvpModelReference, textStreaming, structuredToolCall };
};
