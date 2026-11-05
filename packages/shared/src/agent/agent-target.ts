import { Type, type TObject } from '@sinclair/typebox';
import { AgentTargetSchema } from '../layout/layout-schema.ts';
import { PageIdSchema } from './agent-schema.ts';
import { Value } from '@sinclair/typebox/value';
import type { AgentTarget } from '../layout/layout-schema.ts';

/** Page requests retain their page identity; layouts require an explicit project target. */
export const withAgentTarget = <T extends TObject>(schema: T) =>
  Type.Intersect([
    schema,
    Type.Union([
      Type.Object({ pageId: PageIdSchema, target: Type.Optional(AgentTargetSchema.anyOf[0]) }),
      Type.Object({ pageId: Type.Optional(Type.Never()), target: AgentTargetSchema.anyOf[1] }),
    ]),
  ]);

export const agentTargetFields = (projectId: string, pageId?: string) =>
  pageId
    ? { pageId, target: { kind: 'page' as const, projectId, pageId } }
    : { target: { kind: 'layout' as const, projectId } };

export const resolveAgentTarget = (input: {
  projectId: string;
  pageId?: string;
  target?: AgentTarget;
}): AgentTarget | null => {
  const target =
    input.target ?? (input.pageId ? agentTargetFields(input.projectId, input.pageId).target : null);
  if (
    !target ||
    !Value.Check(AgentTargetSchema, target) ||
    target.projectId !== input.projectId ||
    (target.kind === 'layout' ? input.pageId !== undefined : target.pageId !== input.pageId)
  )
    return null;
  return target;
};
