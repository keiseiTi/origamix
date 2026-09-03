import { Type, type Static } from '@sinclair/typebox';

export const PageWindowSchema = Type.Object(
  {
    projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
    pageId: Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' }),
    mode: Type.Literal('preview'),
  },
  { additionalProperties: false },
);

export type PageWindowInput = Static<typeof PageWindowSchema>;

export const PreviewBoundsSchema = Type.Object(
  {
    x: Type.Integer({ minimum: 0 }),
    y: Type.Integer({ minimum: 0 }),
    width: Type.Integer({ minimum: 1 }),
    height: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export type PreviewBounds = Static<typeof PreviewBoundsSchema>;

export interface PreviewSnapshot {
  schema: import('./protocol/schema').OrigamixPageSchema;
  revisionId: string;
  theme: 'light' | 'dark';
}
