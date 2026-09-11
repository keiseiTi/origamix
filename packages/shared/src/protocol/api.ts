import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { RevisionIdSchema } from './schema';

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
  route: Type.Optional(Type.String({ pattern: '^/(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$' })),
  relativePath: Type.String(),
  status: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const WorkspaceSchema = Type.Object({
  theme: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
  sidebarCollapsed: Type.Boolean(),
  updatedAt: Type.String(),
});

export const CreateProjectSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 80 }),
  code: Type.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }),
  directoryGrantId: Type.String({ minLength: 1 }),
});

export const OpenProjectSchema = Type.Object({
  directoryGrantId: Type.String({ minLength: 1 }),
  initializeIfNeeded: Type.Optional(Type.Boolean()),
});

export const RenameProjectSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 80 }),
});

export const DeleteDesktopRecordSchema = Type.Object({
  scope: Type.Literal('desktop_record'),
});

export const CreatePageSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 80 }),
  slug: Type.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }),
  route: Type.Optional(Type.String({ pattern: '^/(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$' })),
});

export const ApplyPageSchema = Type.Object({
  expectedRevisionId: Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' }),
  clientRequestId: Type.String({ pattern: '^[A-Za-z0-9_-]{1,100}$' }),
});

const SchemaHashSchema = Type.String({ pattern: '^[a-f0-9]{64}$' });

export const PageApplyStateSchema = Type.Object(
  {
    pageId: Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' }),
    workingRevisionId: RevisionIdSchema,
    status: Type.Union([
      Type.Literal('in_sync'),
      Type.Literal('pending'),
      Type.Literal('external_change'),
    ]),
    workingSchemaHash: SchemaHashSchema,
    targetSchemaHash: SchemaHashSchema,
    baselineHash: SchemaHashSchema,
  },
  { additionalProperties: false },
);

export const ApplyPageResultSchema = Type.Object(
  {
    pageId: Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' }),
    revisionId: RevisionIdSchema,
    schemaHash: SchemaHashSchema,
    appliedAt: Type.String({ minLength: 1 }),
    status: Type.Literal('applied'),
  },
  { additionalProperties: false },
);

export const RenamePageSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 80 }),
});

export const DuplicatePageSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
});

export const WorkspacePatchSchema = Type.Partial(
  Type.Object({
    theme: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
    sidebarCollapsed: Type.Boolean(),
  }),
);

export type ApiResult<T> =
  | { success: true; code: 200; data: T }
  | { success: false; code: number; data: null; message?: string };

export const isApiResultEnvelope = (value: unknown): value is ApiResult<unknown> => {
  return Value.Check(ApiResultSchema, value);
};

export const isPageApplyState = (value: unknown): value is PageApplyState =>
  Value.Check(PageApplyStateSchema, value);

export const isApplyPageResult = (value: unknown): value is ApplyPageResult =>
  Value.Check(ApplyPageResultSchema, value);

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  formatVersion: string;
  status: string;
  createdAt: string;
  lastOpenedAt: string;
}

export type OpenProjectResult =
  | { status: 'opened'; project: ProjectRecord }
  | { status: 'initialization_required'; displayPath: string };

export interface PageRecord {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  route?: string;
  relativePath: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageApplyState {
  pageId: string;
  workingRevisionId: string;
  status: 'in_sync' | 'pending' | 'external_change';
  workingSchemaHash: string;
  targetSchemaHash: string;
  baselineHash: string;
}

export interface ApplyPageResult {
  pageId: string;
  revisionId: string;
  schemaHash: string;
  appliedAt: string;
  status: 'applied';
}

export interface WorkspaceRecord {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  updatedAt: string;
}
