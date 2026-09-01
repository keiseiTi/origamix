import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

export const ApiResultSchema = Type.Union([
  Type.Object(
    { success: Type.Literal(true), code: Type.Literal(200), data: Type.Unknown() },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      success: Type.Literal(false),
      code: Type.Integer({ minimum: 400 }),
      data: Type.Null(),
      message: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
]);

export const ProjectRecordSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  path: Type.String(),
  formatVersion: Type.String(),
  status: Type.String(),
  createdAt: Type.String(),
  lastOpenedAt: Type.String(),
});

export const PageRecordSchema = Type.Object({
  id: Type.String(),
  projectId: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  relativePath: Type.String(),
  status: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const WorkspaceSchema = Type.Object({
  activeProjectId: Type.Union([Type.String(), Type.Null()]),
  activePageId: Type.Union([Type.String(), Type.Null()]),
  theme: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
  sidebarCollapsed: Type.Boolean(),
  updatedAt: Type.String(),
});

export const CreateProjectSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 80 }),
  code: Type.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }),
  directoryGrantId: Type.String({ minLength: 1 }),
});

export const OpenProjectSchema = Type.Object({ directoryGrantId: Type.String({ minLength: 1 }) });

export const CreatePageSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 80 }),
  slug: Type.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }),
});

export const WorkspacePatchSchema = Type.Partial(
  Type.Object({
    activeProjectId: Type.Union([Type.String(), Type.Null()]),
    activePageId: Type.Union([Type.String(), Type.Null()]),
    theme: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
    sidebarCollapsed: Type.Boolean(),
  }),
);

export type ApiResult<T> =
  | { success: true; code: 200; data: T }
  | { success: false; code: number; data: null; message?: string };

export function isApiResultEnvelope(value: unknown): value is ApiResult<unknown> {
  return Value.Check(ApiResultSchema, value);
}

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  formatVersion: string;
  status: string;
  createdAt: string;
  lastOpenedAt: string;
}

export interface PageRecord {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  relativePath: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceRecord {
  activeProjectId: string | null;
  activePageId: string | null;
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  updatedAt: string;
}
