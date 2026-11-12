import { Type, type Static } from '@sinclair/typebox';
import { Check } from '@sinclair/typebox/value';
import { ProjectSettingsUpdateSchema } from './project-shell.ts';

export const ProjectSettingsDraftSchema = Type.Pick(ProjectSettingsUpdateSchema, [
  'shell',
  'layout',
  'routing',
]);
export type ProjectSettingsDraft = Static<typeof ProjectSettingsDraftSchema>;
export const ProjectSettingsAgentRequestSchema = Type.Object(
  {
    projectId: ProjectSettingsUpdateSchema.properties.projectId,
    expectedManifestHash: ProjectSettingsUpdateSchema.properties.expectedManifestHash,
    draftVersion: Type.Integer({ minimum: 0 }),
    draft: ProjectSettingsDraftSchema,
    prompt: Type.String({ minLength: 1, maxLength: 8000 }),
    history: Type.Array(
      Type.Object(
        {
          role: Type.Union([Type.Literal('user'), Type.Literal('assistant')]),
          text: Type.String({ maxLength: 8000 }),
        },
        { additionalProperties: false },
      ),
      { maxItems: 12 },
    ),
  },
  { additionalProperties: false },
);
export type ProjectSettingsAgentRequest = Static<typeof ProjectSettingsAgentRequestSchema>;
export const ProjectSettingsAgentEventSchema = Type.Union([
  Type.Object(
    { type: Type.Literal('text'), delta: Type.String() },
    { additionalProperties: false },
  ),
  Type.Object(
    { type: Type.Literal('progress'), message: Type.String() },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal('completed'),
      projectId: Type.String(),
      draftVersion: Type.Integer(),
      text: Type.String(),
      draft: Type.Optional(ProjectSettingsDraftSchema),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    { type: Type.Literal('failed'), message: Type.String() },
    { additionalProperties: false },
  ),
]);
export type ProjectSettingsAgentEvent = Static<typeof ProjectSettingsAgentEventSchema>;
export const isProjectSettingsAgentEvent = (value: unknown): value is ProjectSettingsAgentEvent =>
  Check(ProjectSettingsAgentEventSchema, value);
