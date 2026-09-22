import type { AgentProgressEventPayload, AgentRunStatus } from '@origamix/shared/protocol/agent';

const messages: Partial<Record<AgentRunStatus, string>> = {
  preparing: '正在读取当前页面',
  reasoning: '正在处理请求',
  reading: '正在检查页面信息',
  deciding: '正在整理处理结果',
  validating: '正在验证页面修改',
  repairing: '正在修正未通过校验的修改',
  committing: '正在保存页面草稿',
};

export const progressPayload = (status: AgentRunStatus): AgentProgressEventPayload | undefined => {
  const message = messages[status];
  if (!message) return undefined;
  return {
    status,
    phase: status as AgentProgressEventPayload['phase'],
    message,
  };
};
