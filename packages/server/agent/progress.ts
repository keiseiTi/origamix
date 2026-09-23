import type { AgentProgressEventPayload, AgentRunStatus } from '@origamix/shared/protocol/agent';

const messages: Partial<Record<AgentRunStatus, string>> = {
  preparing: '正在读取当前页面',
  reasoning: '正在思考并规划页面修改',
  reading: '正在调用工具读取页面信息',
  deciding: '正在生成完整操作链',
  validating: '正在执行并验证操作链',
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
