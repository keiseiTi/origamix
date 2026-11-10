import { Check } from '@sinclair/typebox/value';
import { Type, type Static } from '@sinclair/typebox';
import { ProjectManifestSchema } from './project-manifest.ts';
import { ProjectLayoutDocumentSchema } from '../layout/layout-schema.ts';
import { PageSchema } from '../page/page-schema.ts';

export const ProjectPreviewScopeSchema = Type.Object(
  { projectId: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);
export const ProjectPreviewSessionSchema = Type.Object(
  { sessionId: Type.String({ minLength: 1 }), projectId: Type.String({ minLength: 1 }) },
  { additionalProperties: false },
);
export const ProjectPreviewSnapshotSchema = Type.Object({
  snapshotId: Type.String(),
  projectId: Type.String(),
  name: Type.String(),
  manifest: ProjectManifestSchema,
  layout: ProjectLayoutDocumentSchema,
  pageSchemas: Type.Record(Type.String(), PageSchema),
  hasUnappliedChanges: Type.Boolean(),
});
export type ProjectPreviewSnapshot = Static<typeof ProjectPreviewSnapshotSchema>;
export interface ProjectPreviewSession {
  sessionId: string;
  projectId: string;
}
export interface ProjectPreviewLaunch extends ProjectPreviewSession {
  url: string;
  cookie: string;
}

export const isProjectPreviewSnapshot = (value: unknown): value is ProjectPreviewSnapshot =>
  Check(ProjectPreviewSnapshotSchema, value);
