import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import { PageIdSchema } from '../agent/agent-schema.ts';
import { PageSchema, RevisionIdSchema } from '../page/page-schema.ts';
import { isPageSchema } from '../page/page-validation.ts';
import { ProjectStackSchema } from '../project/project-stack.ts';
import { PreviewRenderDiagnosticSchema } from './preview-message.ts';

const strict = { additionalProperties: false } as const;
const snapshotId = Type.String({ minLength: 1, maxLength: 128 });

export const PagePreviewSnapshotSchema = Type.Object(
  {
    snapshotId,
    pageId: PageIdSchema,
    stack: ProjectStackSchema,
    theme: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
    workingVersion: Type.Integer({ minimum: 1 }),
    hash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    revisionId: RevisionIdSchema,
    schema: PageSchema,
  },
  strict,
);
export type PagePreviewSnapshot = Static<typeof PagePreviewSnapshotSchema>;
export const isPagePreviewSnapshot = (value: unknown): value is PagePreviewSnapshot =>
  Value.Check(PagePreviewSnapshotSchema, value) && isPageSchema(value.schema);

export const PagePreviewReportSchema = Type.Object(
  {
    snapshotId,
    pageId: PageIdSchema,
    pageHash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    reportSequence: Type.Integer({ minimum: 1 }),
    outcome: Type.Union([Type.Literal('success'), Type.Literal('failed')]),
    diagnostics: Type.Array(PreviewRenderDiagnosticSchema, { maxItems: 50 }),
  },
  strict,
);
export type PagePreviewReport = Static<typeof PagePreviewReportSchema>;
export const isPagePreviewReport = (value: unknown): value is PagePreviewReport =>
  Value.Check(PagePreviewReportSchema, value);
