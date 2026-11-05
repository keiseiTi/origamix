import { Type, type Static } from '@sinclair/typebox';
import { SchemaOperationSchema } from '../page/schema-operation.ts';
import { RevisionIdSchema } from '../page/page-schema.ts';
import {
  LAYOUT_NAME,
  LayoutProjectIdSchema,
  ProjectLayoutDocumentSchema,
} from './layout-schema.ts';

const strict = { additionalProperties: false } as const;
// Reuse the page editor's exact node operation protocol; no layout IDs or page bindings.
export const LayoutOperationSchema = SchemaOperationSchema;
export const LayoutScopeSchema = Type.Object({ projectId: LayoutProjectIdSchema }, strict);
const expected = { expectedWorkingVersion: Type.Integer({ minimum: 1 }) };
export const LayoutOperationsRequestSchema = Type.Object(
  {
    ...LayoutScopeSchema.properties,
    baseWorkingVersion: Type.Integer({ minimum: 1 }),
    clientRequestId: Type.String({ pattern: '^[A-Za-z0-9_-]{1,100}$' }),
    operations: Type.Array(LayoutOperationSchema, { minItems: 1, maxItems: 200 }),
  },
  strict,
);
export const LayoutSaveRevisionRequestSchema = Type.Object(
  { ...LayoutScopeSchema.properties, ...expected },
  strict,
);
export const LayoutRevisionRequestSchema = Type.Object(
  { ...LayoutScopeSchema.properties, revisionId: RevisionIdSchema },
  strict,
);
export const LayoutRestoreRevisionRequestSchema = Type.Object(
  { ...LayoutRevisionRequestSchema.properties, ...expected },
  strict,
);
export const LayoutWorkingStateSchema = Type.Object(
  {
    document: ProjectLayoutDocumentSchema,
    workingVersion: Type.Integer({ minimum: 1 }),
    workingHash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    revisionId: Type.Union([RevisionIdSchema, Type.Null()]),
    savedSchemaHash: Type.Union([Type.String({ pattern: '^[a-f0-9]{64}$' }), Type.Null()]),
  },
  strict,
);
export type LayoutOperation = Static<typeof LayoutOperationSchema>;
export type LayoutOperationsRequest = Static<typeof LayoutOperationsRequestSchema>;
export type LayoutWorkingState = Static<typeof LayoutWorkingStateSchema>;

export const LayoutRevisionSnapshotSchema = Type.Object(
  {
    projectId: LayoutProjectIdSchema,
    revisionId: RevisionIdSchema,
    parentRevisionId: Type.Union([RevisionIdSchema, Type.Null()]),
    createdAt: Type.String({ minLength: 1 }),
    schemaHash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    document: ProjectLayoutDocumentSchema,
  },
  strict,
);
export const LayoutRevisionHistorySchema = Type.Object(
  {
    revisions: Type.Array(
      Type.Object(
        {
          ...Type.Omit(LayoutRevisionSnapshotSchema, ['document']).properties,
          isCurrent: Type.Boolean(),
        },
        strict,
      ),
    ),
  },
  strict,
);
export type LayoutRevisionSnapshot = Static<typeof LayoutRevisionSnapshotSchema>;
export type LayoutRevisionHistory = Static<typeof LayoutRevisionHistorySchema>;

export const LayoutConfigRequestSchema = LayoutScopeSchema;
export const LayoutConfigUpdateRequestSchema = Type.Object(
  {
    ...LayoutScopeSchema.properties,
    enabled: Type.Boolean(),
  },
  strict,
);
export const LayoutConfigStateSchema = Type.Object(
  {
    name: Type.Literal(LAYOUT_NAME),
    enabled: Type.Boolean(),
  },
  strict,
);
export type LayoutConfigState = Static<typeof LayoutConfigStateSchema>;

const hash = Type.String({ pattern: '^[a-f0-9]{64}$' });
export const LayoutApplyRequestSchema = Type.Object(
  {
    ...LayoutScopeSchema.properties,
    expectedRevisionId: RevisionIdSchema,
    expectedWorkingVersion: Type.Integer({ minimum: 1 }),
    clientRequestId: Type.String({ pattern: '^[A-Za-z0-9_-]{1,100}$' }),
  },
  strict,
);
export const LayoutApplyResultSchema = Type.Object(
  {
    projectId: LayoutProjectIdSchema,
    revisionId: RevisionIdSchema,
    schemaHash: hash,
    appliedAt: Type.String({ minLength: 1 }),
    status: Type.Literal('applied'),
  },
  strict,
);
export type LayoutApplyRequest = Static<typeof LayoutApplyRequestSchema>;
export type LayoutApplyResult = Static<typeof LayoutApplyResultSchema>;

export const LayoutApplyStateSchema = Type.Object(
  {
    ...LayoutScopeSchema.properties,
    revisionId: Type.Union([RevisionIdSchema, Type.Null()]),
    workingVersion: Type.Integer({ minimum: 1 }),
    workingHash: hash,
    savedSchemaHash: Type.Union([hash, Type.Null()]),
    baselineHash: Type.Union([hash, Type.Null()]),
    targetSchemaHash: Type.Union([hash, Type.Null()]),
    status: Type.Union(
      ['draft_unsaved', 'saved_pending_apply', 'in_sync', 'external_change', 'apply_pending'].map(
        (value) => Type.Literal(value),
      ),
    ),
  },
  strict,
);
export type LayoutApplyState = Static<typeof LayoutApplyStateSchema>;
