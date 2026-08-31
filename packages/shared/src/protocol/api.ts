import { Type } from '@sinclair/typebox';

export const ApiResultSchema = Type.Object({
  ok: Type.Boolean(),
  data: Type.Optional(Type.Unknown()),
  error: Type.Optional(
    Type.Object({
      code: Type.String(),
      message: Type.String(),
      details: Type.Optional(Type.Unknown()),
      requestId: Type.String()
    })
  )
});

export const ProjectRecordSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  path: Type.String(),
  formatVersion: Type.String(),
  status: Type.String(),
  createdAt: Type.String(),
  lastOpenedAt: Type.String()
});

export const PageRecordSchema = Type.Object({
  id: Type.String(),
  projectId: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  relativePath: Type.String(),
  status: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String()
});

export const WorkspaceSchema = Type.Object({
  activeProjectId: Type.Union([Type.String(), Type.Null()]),
  activePageId: Type.Union([Type.String(), Type.Null()]),
  theme: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
  sidebarCollapsed: Type.Boolean(),
  updatedAt: Type.String()
});

export const CreateProjectSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 80 }),
  code: Type.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }),
  directoryGrantId: Type.String({ minLength: 1 })
});

export const OpenProjectSchema = Type.Object({ directoryGrantId: Type.String({ minLength: 1 }) });

export const CreatePageSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 80 }),
  slug: Type.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' })
});

export const WorkspacePatchSchema = Type.Partial(
  Type.Object({
    activeProjectId: Type.Union([Type.String(), Type.Null()]),
    activePageId: Type.Union([Type.String(), Type.Null()]),
    theme: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
    sidebarCollapsed: Type.Boolean()
  })
);

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown; requestId: string } };

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
