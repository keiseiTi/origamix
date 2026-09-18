import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { ChangeSourceSchema, PageSchema, RevisionIdSchema, SchemaOperationSchema } from './schema';

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
  status: Type.Integer({ minimum: 0, maximum: 5 }),
  createdAt: Type.String(),
  lastOpenedAt: Type.String(),
});

export const PageRecordSchema = Type.Object({
  id: Type.String(),
  projectId: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  relativePath: Type.String(),
  status: Type.Integer({ minimum: 0, maximum: 5 }),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const CreateProjectSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 80 }),
  code: Type.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }),
  pageDirectory: Type.String({ pattern: '^[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*$' }),
  directoryGrantId: Type.String({ minLength: 1 }),
});

export const OpenProjectSchema = Type.Object({
  directoryGrantId: Type.String({ minLength: 1 }),
  pageDirectory: Type.String({ pattern: '^[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*$' }),
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
});

export const ApplyPageSchema = Type.Object({
  expectedRevisionId: Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' }),
  expectedWorkingVersion: Type.Integer({ minimum: 1 }),
  clientRequestId: Type.String({ pattern: '^[A-Za-z0-9_-]{1,100}$' }),
});

export const SaveWorkingRevisionSchema = Type.Object(
  { expectedWorkingVersion: Type.Integer({ minimum: 1 }) },
  { additionalProperties: false },
);

export const RestoreWorkingRevisionSchema = Type.Object(
  { expectedWorkingVersion: Type.Integer({ minimum: 1 }) },
  { additionalProperties: false },
);

const SchemaHashSchema = Type.String({ pattern: '^[a-f0-9]{64}$' });

export const WorkingSchemaStateSchema = Type.Object(
  {
    schema: PageSchema,
    revisionId: RevisionIdSchema,
    workingVersion: Type.Integer({ minimum: 1 }),
    workingHash: SchemaHashSchema,
    savedSchemaHash: SchemaHashSchema,
    baselineHash: SchemaHashSchema,
  },
  { additionalProperties: false },
);

export const UpdateWorkingSchemaSchema = Type.Object(
  {
    baseWorkingVersion: Type.Integer({ minimum: 1 }),
    schema: PageSchema,
  },
  { additionalProperties: false },
);

export const ApplyWorkingOperationsSchema = Type.Object(
  {
    baseWorkingVersion: Type.Integer({ minimum: 1 }),
    operations: Type.Array(SchemaOperationSchema, { minItems: 1, maxItems: 200 }),
  },
  { additionalProperties: false },
);

export const RevisionHistoryItemSchema = Type.Object(
  {
    revisionId: RevisionIdSchema,
    parentRevisionId: Type.Union([RevisionIdSchema, Type.Null()]),
    source: ChangeSourceSchema,
    createdAt: Type.String({ minLength: 1 }),
    schemaHash: SchemaHashSchema,
    isCurrent: Type.Boolean(),
    isApplied: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const RevisionHistorySchema = Type.Object(
  { revisions: Type.Array(RevisionHistoryItemSchema) },
  { additionalProperties: false },
);

export const PageApplyStateSchema = Type.Object(
  {
    pageId: Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' }),
    savedRevisionId: RevisionIdSchema,
    workingVersion: Type.Integer({ minimum: 1 }),
    status: Type.Union([
      Type.Literal('in_sync'),
      Type.Literal('draft_unsaved'),
      Type.Literal('saved_pending_apply'),
      Type.Literal('external_change'),
    ]),
    workingHash: SchemaHashSchema,
    savedSchemaHash: SchemaHashSchema,
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
  status: number;
  createdAt: string;
  lastOpenedAt: string;
}

export type OpenProjectResult =
  | { status: 'opened'; project: ProjectRecord }
  | {
      status: 'initialization_required';
      displayPath: string;
      inspection: ProjectInitializationInspection;
    };

export interface ProjectInitializationInspection {
  directoryKind: 'empty' | 'existing_application';
  discoveredPages: Array<{ name: string; slug: string }>;
  plannedChanges: string[];
  blockers: string[];
}

export interface PageRecord {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  relativePath: string;
  status: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageApplyState {
  pageId: string;
  savedRevisionId: string;
  workingVersion: number;
  status: 'in_sync' | 'draft_unsaved' | 'saved_pending_apply' | 'external_change';
  workingHash: string;
  savedSchemaHash: string;
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

export type RevisionHistoryItem = Static<typeof RevisionHistoryItemSchema>;
export type RevisionHistory = Static<typeof RevisionHistorySchema>;
