import { Type, type Static } from '@sinclair/typebox';
import { Check } from '@sinclair/typebox/value';

export const SYSTEM_PAGE_ROLES = [
  { id: 'login', name: '登录页', kind: 'system' as const },
  { id: 'home', name: '首页', kind: 'system' as const },
  { id: 'not-found', name: '未找到页面', kind: 'system' as const },
] as const;
export const PageRoleIdSchema = Type.String({
  pattern: '^[a-z][a-z0-9-]{0,63}$',
  not: { enum: ['none', 'constructor', 'prototype', '__proto__'] },
});
export const ProjectPageRolesSchema = Type.Object(
  {
    definitions: Type.Array(
      Type.Object(
        {
          id: PageRoleIdSchema,
          name: Type.String({ minLength: 1, maxLength: 80 }),
          kind: Type.Literal('custom'),
        },
        { additionalProperties: false },
      ),
      { maxItems: 100 },
    ),
    assignments: Type.Record(PageRoleIdSchema, Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' })),
  },
  { additionalProperties: false },
);
export type ProjectPageRoles = Static<typeof ProjectPageRolesSchema>;
export const emptyPageRoles = (): ProjectPageRoles => ({ definitions: [], assignments: {} });
export const arePageRolesValid = (
  roles: unknown,
  pages: readonly { pageId: string }[],
): roles is ProjectPageRoles => {
  if (!Check(ProjectPageRolesSchema, roles)) return false;
  const ids = new Set<string>(SYSTEM_PAGE_ROLES.map((role) => role.id));
  for (const role of roles.definitions) {
    if (ids.has(role.id) || !role.name.trim()) return false;
    ids.add(role.id);
  }
  const assigned = Object.values(roles.assignments);
  return (
    new Set(assigned).size === assigned.length &&
    Object.entries(roles.assignments).every(
      ([roleId, pageId]) => ids.has(roleId) && pages.some((page) => page.pageId === pageId),
    )
  );
};
export const PageRoleStateSchema = Type.Object(
  {
    roles: ProjectPageRolesSchema,
    manifestHash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    pages: Type.Array(Type.Object({ pageId: Type.String(), name: Type.String() })),
  },
  { additionalProperties: false },
);
export type PageRoleState = Static<typeof PageRoleStateSchema>;
export const UpdatePageRolesSchema = Type.Object(
  {
    projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
    roles: ProjectPageRolesSchema,
    expectedManifestHash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    clientRequestId: Type.String({ pattern: '^[A-Za-z0-9_-]{1,100}$' }),
  },
  { additionalProperties: false },
);
export type UpdatePageRoles = Static<typeof UpdatePageRolesSchema>;
