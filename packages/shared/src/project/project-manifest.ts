import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { VersionedStackReferenceSchema } from './project-stack.ts';
import { Value } from '@sinclair/typebox/value';

export const ProjectPageManifestSchema = Type.Object({
  pageId: Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' }),
  name: Type.String({ minLength: 1, maxLength: 80 }),
  slug: Type.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }),
});

export const ProjectLayoutConfigSchema = Type.Object(
  { enabled: Type.Boolean() },
  { additionalProperties: false },
);

export const ProjectManifestSchema = Type.Object({
  projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
  name: Type.String({ minLength: 1, maxLength: 80 }),
  framework: Type.String({ minLength: 1, maxLength: 100 }),
  materialSet: VersionedStackReferenceSchema,
  pageDirectory: Type.String({ pattern: '^[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*$' }),
  pages: Type.Array(ProjectPageManifestSchema),
  layout: Type.Optional(ProjectLayoutConfigSchema),
});

export type ProjectPageManifest = Static<typeof ProjectPageManifestSchema>;

export type ProjectManifest = Static<typeof ProjectManifestSchema>;

export const isProjectManifest = (value: unknown): value is ProjectManifest =>
  Value.Check(ProjectManifestSchema, value);

/** Older manifests without layout configuration stay disabled without an on-read rewrite. */
export const isProjectLayoutEnabled = (manifest: ProjectManifest): boolean =>
  manifest.layout?.enabled === true;
