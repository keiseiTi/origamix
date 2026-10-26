import {
  strictObject,
  PageIdSchema,
  AgentProtocolVersionSchema,
  IsoDateTimeSchema,
} from './agent-schema.ts';
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

export const RuntimeDiagnosticSchema = strictObject({
  code: Type.String({ minLength: 1, maxLength: 128 }),
  severity: Type.Union([Type.Literal('warning'), Type.Literal('error')]),
  stage: Type.Union([
    Type.Literal('load'),
    Type.Literal('material'),
    Type.Literal('expression'),
    Type.Literal('render'),
    Type.Literal('event'),
  ]),
  pageId: PageIdSchema,
  revisionId: Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' }),
  elementId: Type.Optional(Type.String({ pattern: '^[A-Za-z][A-Za-z0-9_-]*$' })),
  materialType: Type.Optional(Type.String({ minLength: 1 })),
  safeMessage: Type.String({ minLength: 1, maxLength: 2_000 }),
});

export const RuntimeRenderReportSchema = strictObject({
  version: AgentProtocolVersionSchema,
  projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
  pageId: PageIdSchema,
  revisionId: Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' }),
  outcome: Type.Union([Type.Literal('success'), Type.Literal('failed')]),
  diagnostics: Type.Array(RuntimeDiagnosticSchema, { maxItems: 50 }),
  observedAt: IsoDateTimeSchema,
});

export const RuntimeReportResultSchema = strictObject({
  version: AgentProtocolVersionSchema,
  disposition: Type.Union([Type.Literal('accepted'), Type.Literal('stale')]),
  currentRevisionId: Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' }),
  visualRevisionId: Type.Optional(Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' })),
});

export const PageRuntimeStateSchema = strictObject({
  version: AgentProtocolVersionSchema,
  projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
  pageId: PageIdSchema,
  currentRevisionId: Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' }),
  lastKnownGoodRevisionId: Type.Optional(Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' })),
  visualRevisionId: Type.Optional(Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' })),
  diagnostics: Type.Array(RuntimeDiagnosticSchema),
});

export type RuntimeDiagnostic = Static<typeof RuntimeDiagnosticSchema>;

export type RuntimeRenderReport = Static<typeof RuntimeRenderReportSchema>;

export type RuntimeReportResult = Static<typeof RuntimeReportResultSchema>;

export type PageRuntimeState = Static<typeof PageRuntimeStateSchema>;
