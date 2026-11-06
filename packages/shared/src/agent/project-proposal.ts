import { Type, type Static } from '@sinclair/typebox';
import {
  PageRoleIdSchema,
  ProjectPageRolesSchema,
  arePageRolesValid,
  type ProjectPageRoles,
} from '../project/page-role.ts';

export const ProjectRoleOperationSchema = Type.Union([
  Type.Object(
    {
      type: Type.Literal('pageRole.assign'),
      roleId: PageRoleIdSchema,
      pageId: Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { type: Type.Literal('pageRole.unassign'), roleId: PageRoleIdSchema },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal('pageRole.create'),
      roleId: PageRoleIdSchema,
      name: Type.String({ minLength: 1, maxLength: 80 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { type: Type.Literal('pageRole.remove'), roleId: PageRoleIdSchema },
    { additionalProperties: false },
  ),
]);
export type ProjectRoleOperation = Static<typeof ProjectRoleOperationSchema>;
export const ProjectProposalSchema = Type.Object(
  {
    expectedManifestHash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    operations: Type.Array(ProjectRoleOperationSchema, { minItems: 1, maxItems: 20 }),
    before: ProjectPageRolesSchema,
    after: ProjectPageRolesSchema,
    pages: Type.Array(Type.Object({ pageId: Type.String(), name: Type.String() })),
    pageIntent: Type.Optional(Type.String({ minLength: 1, maxLength: 8000 })),
    response: Type.String({ minLength: 1, maxLength: 40000 }),
  },
  { additionalProperties: false },
);
export type ProjectProposal = Static<typeof ProjectProposalSchema>;
export const applyProjectRoleOperations = (
  roles: ProjectPageRoles,
  operations: readonly ProjectRoleOperation[],
  pages: readonly { pageId: string }[],
): ProjectPageRoles => {
  const next = structuredClone(roles);
  for (const operation of operations) {
    if (operation.type === 'pageRole.assign') {
      next.assignments = Object.fromEntries(
        Object.entries(next.assignments).filter(([, pageId]) => pageId !== operation.pageId),
      );
      next.assignments[operation.roleId] = operation.pageId;
    } else if (operation.type === 'pageRole.unassign') delete next.assignments[operation.roleId];
    else if (operation.type === 'pageRole.create') {
      next.definitions.push({ id: operation.roleId, name: operation.name, kind: 'custom' });
    } else {
      if (!next.definitions.some((role) => role.id === operation.roleId))
        throw new Error('只能删除自定义角色');
      next.definitions = next.definitions.filter((role) => role.id !== operation.roleId);
      delete next.assignments[operation.roleId];
    }
  }
  if (!arePageRolesValid(next, pages)) throw new Error('项目角色操作无效');
  return next;
};
export const ProjectTaskScopeSchema = Type.Object(
  {
    projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
    pageId: Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' }),
    runId: Type.String({ pattern: '^run_[A-Za-z0-9_-]+$' }),
  },
  { additionalProperties: false },
);
export const ProjectTaskDecisionSchema = Type.Object(
  {
    ...ProjectTaskScopeSchema.properties,
    decision: Type.Union([Type.Literal('confirm'), Type.Literal('cancel')]),
  },
  { additionalProperties: false },
);
export type ProjectTaskScope = Static<typeof ProjectTaskScopeSchema>;
export type ProjectTaskDecision = Static<typeof ProjectTaskDecisionSchema>;
export const ProjectTaskStateSchema = Type.Object(
  {
    ...ProjectTaskScopeSchema.properties,
    proposal: ProjectProposalSchema,
    phase: Type.Union(
      [
        'awaiting_confirmation',
        'applying_project',
        'project_applied',
        'running_page',
        'completed',
        'cancelled',
        'page_failed',
        'project_failed',
      ].map((value) => Type.Literal(value)),
    ),
    failure: Type.Optional(Type.String()),
    childRunId: Type.Optional(Type.String()),
    pageStatus: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
export type ProjectTaskState = Static<typeof ProjectTaskStateSchema>;
