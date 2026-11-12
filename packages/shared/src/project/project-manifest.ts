import { ProjectShellSchema, projectShellIssue } from './project-shell.ts';

import { ProjectRoutingSchema, InitialLayoutVariantSchema } from './project-routing.ts';
import { ProjectPageRolesSchema, arePageRolesValid } from './page-role.ts';
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
  { enabled: Type.Boolean(), initialVariant: InitialLayoutVariantSchema },
  { additionalProperties: false },
);

export const ProjectManifestSchema = Type.Object(
  {
    shell: ProjectShellSchema,
    runtime: Type.Union([Type.Literal('origamix'), Type.Literal('external')]),
    code: Type.Optional(Type.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' })),
    projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
    name: Type.String({ minLength: 1, maxLength: 80 }),
    framework: Type.String({ minLength: 1, maxLength: 100 }),
    materialSet: VersionedStackReferenceSchema,
    pageDirectory: Type.String({ pattern: '^[a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*$' }),
    pages: Type.Array(ProjectPageManifestSchema),
    layout: ProjectLayoutConfigSchema,
    routing: ProjectRoutingSchema,
    pageRoles: Type.Optional(ProjectPageRolesSchema),
  },
  { additionalProperties: false },
);

export type ProjectPageManifest = Static<typeof ProjectPageManifestSchema>;

export type ProjectManifest = Static<typeof ProjectManifestSchema>;

export const isProjectManifest = (value: unknown): value is ProjectManifest => {
  if (
    !Value.Check(ProjectManifestSchema, value) ||
    (value.pageRoles && !arePageRolesValid(value.pageRoles, value.pages))
  )
    return false;
  try {
    if (projectShellIssue(value.shell, value.pages)) return false;
    return true;
  } catch {
    return false;
  }
};

export const isProjectLayoutEnabled = (manifest: ProjectManifest): boolean =>
  manifest.runtime === 'origamix' && manifest.layout.enabled;
