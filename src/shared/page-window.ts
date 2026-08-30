import { Type, type Static } from '@sinclair/typebox';

export const PageWindowSchema = Type.Object(
  {
    projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
    pageId: Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' }),
    mode: Type.Literal('preview')
  },
  { additionalProperties: false }
);

export type PageWindowInput = Static<typeof PageWindowSchema>;

export interface PreviewSnapshot {
  schema: import('./protocol/schema').OrigamixPageSchema;
  revisionId: string;
  theme: 'light' | 'dark';
}
