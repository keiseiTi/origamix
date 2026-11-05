import { agentTargetFields, resolveAgentTarget, type AgentTarget } from '@origamix/shared';
import { invalid } from '../errors';

export const agentTarget = (projectId: string, pageId?: string): AgentTarget =>
  agentTargetFields(projectId, pageId).target;

export const requireAgentTarget = (input: {
  projectId: string;
  pageId?: string;
  target?: AgentTarget;
}): AgentTarget => {
  const target = resolveAgentTarget(input);
  if (!target) throw invalid('Agent 目标无效或归属不一致');
  return target;
};
