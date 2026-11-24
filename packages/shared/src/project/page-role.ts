import { Type, type Static } from '@sinclair/typebox';
import { Check } from '@sinclair/typebox/value';

export const SYSTEM_PAGE_ROLES = [
  { id: 'login', name: '登录页', kind: 'system' as const },
] as const;
export const PageRoleIdSchema = Type.Literal('login');
export type PageRoleId = Static<typeof PageRoleIdSchema>;
export const ProjectPageRolesSchema = Type.Object(
  {
    assignments: Type.Object(
      { login: Type.Optional(Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' })) },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export type ProjectPageRoles = Static<typeof ProjectPageRolesSchema>;
export const emptyPageRoles = (): ProjectPageRoles => ({ assignments: {} });
export const arePageRolesValid = (
  roles: unknown,
  pages: readonly { pageId: string }[],
): roles is ProjectPageRoles => {
  if (!Check(ProjectPageRolesSchema, roles)) return false;
  const { login } = roles.assignments;
  return login === undefined || pages.some((page) => page.pageId === login);
};
export const PageRoleStateSchema = Type.Object(
  {
    roles: ProjectPageRolesSchema,
    pages: Type.Array(Type.Object({ pageId: Type.String(), name: Type.String() })),
  },
  { additionalProperties: false },
);
export type PageRoleState = Static<typeof PageRoleStateSchema>;
export const UpdatePageRolesSchema = Type.Object(
  {
    projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
    roles: ProjectPageRolesSchema,
    page: Type.Optional(
      Type.Object(
        {
          pageId: Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' }),
          name: Type.String({ minLength: 1, maxLength: 80 }),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);
export type UpdatePageRoles = Static<typeof UpdatePageRolesSchema>;
