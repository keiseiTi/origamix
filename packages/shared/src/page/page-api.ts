import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { PageSchema, RevisionIdSchema } from './page-schema.ts';
import { SchemaOperationSchema, ChangeSourceSchema } from './schema-operation.ts';
import { Value } from '@sinclair/typebox/value';

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

export const isPageApplyState = (value: unknown): value is PageApplyState =>
  Value.Check(PageApplyStateSchema, value);

export const isApplyPageResult = (value: unknown): value is ApplyPageResult =>
  Value.Check(ApplyPageResultSchema, value);

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
