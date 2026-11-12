import { Type, type TObject, type Static } from '@sinclair/typebox';
import { PageIdSchema } from './agent-schema.ts';
import { Value } from '@sinclair/typebox/value';
export const AgentTargetSchema = Type.Object(
  {
    kind: Type.Literal('page'),
    projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
    pageId: PageIdSchema,
  },
  { additionalProperties: false },
);
export type AgentTarget = Static<typeof AgentTargetSchema>;
export const SessionTargetSchema = AgentTargetSchema;
export type SessionTarget = AgentTarget;
export const withAgentTarget = <T extends TObject>(schema: T) =>
  Type.Intersect([
    schema,
    Type.Object({ pageId: PageIdSchema, target: Type.Optional(AgentTargetSchema) }),
  ]);
export const agentTargetFields = (projectId: string, pageId?: string) => {
  if (!pageId) throw new Error('页面 ID 缺失');
  return { pageId, target: { kind: 'page' as const, projectId, pageId } };
};
export const resolveAgentTarget = (input: {
  projectId: string;
  pageId?: string;
  target?: AgentTarget;
}): AgentTarget | null => {
  if (!input.pageId) return null;
  const target = input.target ?? agentTargetFields(input.projectId, input.pageId).target;
  return Value.Check(AgentTargetSchema, target) &&
    target.projectId === input.projectId &&
    target.pageId === input.pageId
    ? target
    : null;
};
