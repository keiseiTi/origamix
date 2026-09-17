import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

export const ProjectPageManifestSchema = Type.Object({
  pageId: Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' }),
  name: Type.String({ minLength: 1, maxLength: 80 }),
  slug: Type.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }),
});

export const ProjectManifestSchema = Type.Object({
  projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
  name: Type.String({ minLength: 1, maxLength: 80 }),
  framework: Type.Literal('react'),
  uiLibrary: Type.Literal('antd'),
  pageDirectory: Type.String({ pattern: '^[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*$' }),
  pages: Type.Array(ProjectPageManifestSchema),
});

export type ProjectPageManifest = Static<typeof ProjectPageManifestSchema>;
export type ProjectManifest = Static<typeof ProjectManifestSchema>;

export const isProjectManifest = (value: unknown): value is ProjectManifest =>
  Value.Check(ProjectManifestSchema, value);
