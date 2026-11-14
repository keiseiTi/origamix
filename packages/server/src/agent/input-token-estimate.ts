import type { Context } from '@earendil-works/pi-ai';

/**
 * Estimate the text/JSON sent to the provider, not the SDK's session record.
 * Two UTF-8 bytes per token plus protocol headroom is deliberately cautious for
 * our mixed Chinese/JSON inputs, but is not a tokenizer or a strict upper bound.
 * Actual provider usage remains authoritative after each request.
 */
export const measureInputContext = (context: Context) => {
  const input = {
    systemPrompt: context.systemPrompt,
    tools: context.tools,
    messages: context.messages.map((message) => {
      if (message.role === 'system') {
        return {
          role: message.role,
          content: message.content,
          sections: message.sections,
          toolsAdded: message.toolsAdded,
          toolsRemoved: message.toolsRemoved,
        };
      }
      if (message.role === 'toolResult') {
        return {
          role: message.role,
          toolCallId: message.toolCallId,
          toolName: message.toolName,
          content: message.content,
          isError: message.isError,
        };
      }
      return { role: message.role, content: message.content };
    }),
  };
  const bytes = (value: unknown) =>
    value === undefined ? 0 : Buffer.byteLength(JSON.stringify(value), 'utf8');
  const sizes = {
    systemBytes: bytes(context.systemPrompt),
    toolDefinitionBytes: bytes(context.tools),
    userBytes: 0,
    assistantBytes: 0,
    toolResultBytes: 0,
  };
  for (const message of input.messages) {
    if (message.role === 'system') {
      sizes.systemBytes += bytes(message.content) + bytes(message.sections);
      sizes.toolDefinitionBytes += bytes(message.toolsAdded) + bytes(message.toolsRemoved);
    } else if (message.role === 'user') sizes.userBytes += bytes(message.content);
    else if (message.role === 'assistant') sizes.assistantBytes += bytes(message.content);
    else sizes.toolResultBytes += bytes(message.content);
  }
  const inputBytes = bytes(input);
  return { ...sizes, inputBytes, estimatedInputTokens: Math.ceil(inputBytes / 2) + 2048 };
};

export const estimateInputTokens = (context: Context): number =>
  measureInputContext(context).estimatedInputTokens;
