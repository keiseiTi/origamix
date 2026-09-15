import type { AgentRunStatus } from '@origamix/shared/protocol/agent';

const createCodec = <T extends string>(values: readonly T[]) => ({
  encode: (value: T): number => {
    const code = values.indexOf(value);
    if (code < 0) throw new Error(`未知状态：${value}`);
    return code;
  },
  decode: (code: number): T => {
    const value = values[code];
    if (!value) throw new Error(`未知状态编码：${code}`);
    return value;
  },
  codes: values.map((_, index) => index),
});

export const conversationStatus = createCodec(['active', 'archived', 'deleted']);
export const messageStatus = createCodec(['pending', 'streaming', 'completed', 'failed']);
export const agentRunStatus = createCodec<AgentRunStatus>([
  'queued',
  'classifying',
  'generating',
  'tool_calling',
  'validating',
  'committing',
  'awaiting_confirmation',
  'cancelling',
  'completed',
  'failed',
  'cancelled',
  'interrupted',
]);
