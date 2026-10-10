import { Type, type TObject, type TProperties } from '@sinclair/typebox';
import { PageIdSchema } from '@origamix/shared/protocol/agent';

export const ProjectIdSchema = Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' });
export const ProjectScopeSchema = Type.Object(
  { projectId: ProjectIdSchema },
  { additionalProperties: false },
);
export const PageScopeSchema = Type.Object(
  { projectId: ProjectIdSchema, pageId: PageIdSchema },
  { additionalProperties: false },
);
export const EmptyBodySchema = Type.Object({}, { additionalProperties: false });

export const withProjectScope = <T extends TProperties>(schema: TObject<T>) =>
  Type.Object(
    { ...schema.properties, projectId: ProjectIdSchema },
    { additionalProperties: false },
  );

export const withPageScope = <T extends TProperties>(schema: TObject<T>) =>
  Type.Object(
    { ...schema.properties, projectId: ProjectIdSchema, pageId: PageIdSchema },
    { additionalProperties: false },
  );
