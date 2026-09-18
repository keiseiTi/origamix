import { Type, type Static } from '@sinclair/typebox';

export interface PreviewSnapshot {
  schema: import('./protocol/schema').OrigamixPageSchema;
  revisionId: string;
  theme: 'light' | 'dark';
}

export const PreviewRenderDiagnosticSchema = Type.Object(
  {
    code: Type.String({ minLength: 1, maxLength: 128 }),
    severity: Type.Union([Type.Literal('warning'), Type.Literal('error')]),
    stage: Type.Union([
      Type.Literal('load'),
      Type.Literal('material'),
      Type.Literal('expression'),
      Type.Literal('render'),
      Type.Literal('event'),
    ]),
    elementId: Type.Optional(Type.String()),
    materialType: Type.Optional(Type.String()),
    safeMessage: Type.String({ minLength: 1, maxLength: 2_000 }),
  },
  { additionalProperties: false },
);

export type PreviewRenderDiagnostic = Static<typeof PreviewRenderDiagnosticSchema>;

export const PreviewRenderReportSchema = Type.Object(
  {
    revisionId: Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' }),
    outcome: Type.Union([Type.Literal('success'), Type.Literal('failed')]),
    diagnostics: Type.Array(PreviewRenderDiagnosticSchema, { maxItems: 50 }),
    observedAt: Type.String({ minLength: 1, maxLength: 64 }),
  },
  { additionalProperties: false },
);

export type PreviewRenderReport = Static<typeof PreviewRenderReportSchema>;
