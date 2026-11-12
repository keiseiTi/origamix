import { Value } from '@sinclair/typebox/value';
import { isPageSchema } from '../page/page-validation.ts';
import { PreviewRenderDiagnosticSchema } from './preview-message.ts';
import { Type, type Static } from '@sinclair/typebox';
import { PageIdSchema } from '../agent/agent-schema.ts';
import { PageSchema, RevisionIdSchema } from '../page/page-schema.ts';
import { ProjectStackSchema } from '../project/project-stack.ts';

const strict = { additionalProperties: false } as const;
const identity = {
  workingVersion: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  hash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
  revisionId: Type.Union([RevisionIdSchema, Type.Null()]),
};
/** One immutable composition snapshot, transported by the trusted host without credentials. */
export const ApplicationSnapshotSchema = Type.Object(
  {
    version: Type.Literal('1'),
    snapshotId: Type.String({ minLength: 1, maxLength: 128 }),
    source: Type.Literal('working'),
    stack: ProjectStackSchema,
    theme: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
    initialPageId: Type.Union([PageIdSchema, Type.Null()]),
    pages: Type.Array(
      Type.Object(
        {
          pageId: PageIdSchema,
          name: Type.String(),
          path: Type.String({ pattern: '^/(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$' }),
        },
        strict,
      ),
    ),
    pageSchemas: Type.Record(
      PageIdSchema,
      Type.Object({ ...identity, schema: PageSchema }, strict),
      strict,
    ),
  },
  strict,
);
export type ApplicationSnapshot = Static<typeof ApplicationSnapshotSchema>;

/** Checks page-directory identity and references as well as serializable transport shape. */
export const isApplicationSnapshot = (value: unknown): value is ApplicationSnapshot => {
  if (!Value.Check(ApplicationSnapshotSchema, value)) return false;
  const ids = new Set(value.pages.map((page) => page.pageId));
  const paths = new Set(value.pages.map((page) => page.path));
  if (
    ids.size !== value.pages.length ||
    paths.size !== value.pages.length ||
    (value.initialPageId !== null && !ids.has(value.initialPageId)) ||
    Object.keys(value.pageSchemas).length !== ids.size
  )
    return false;
  for (const pageId of ids) {
    const page = value.pageSchemas[pageId];
    if (
      !page ||
      !isPageSchema(page.schema) ||
      (value.source === 'working' && page.workingVersion === null)
    )
      return false;
  }
  return true;
};
export const ApplicationRenderReportSchema = Type.Object(
  {
    snapshotId: Type.String({ minLength: 1, maxLength: 128 }),
    pageId: PageIdSchema,
    pageHash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
    reportSequence: Type.Integer({ minimum: 1 }),
    outcome: Type.Union([Type.Literal('success'), Type.Literal('failed')]),
    diagnostics: Type.Array(PreviewRenderDiagnosticSchema, { maxItems: 50 }),
    observedAt: Type.String({ minLength: 1, maxLength: 64 }),
  },
  strict,
);
export type ApplicationRenderReport = Static<typeof ApplicationRenderReportSchema>;
export const isApplicationRenderReport = (value: unknown): value is ApplicationRenderReport =>
  Value.Check(ApplicationRenderReportSchema, value);
