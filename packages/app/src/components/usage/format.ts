import type { AgentTokenUsage } from '@origamix/shared';

const exact = new Intl.NumberFormat('zh-CN');
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

export const formatTokens = (value: number) => exact.format(value);
export const compactTokens = (value: number) => compact.format(value);
export const totalTokens = ({ inputTokens, outputTokens }: AgentTokenUsage) =>
  inputTokens + outputTokens;
