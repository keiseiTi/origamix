import { Value } from '@sinclair/typebox/value';
import { Type, type Static } from '@sinclair/typebox';

/** Deployment prefixes are local absolute directories, never URLs or route expressions. */
export const ProjectRoutingSchema = Type.Object(
  {
    mode: Type.Union([Type.Literal('browser'), Type.Literal('hash')]),
    basePath: Type.String({ pattern: '^/(?:[A-Za-z0-9_-]+/)*(?![\\s\\S])', maxLength: 200 }),
  },
  { additionalProperties: false },
);
export type ProjectRouting = Static<typeof ProjectRoutingSchema>;
export const isProjectRouting = (value: unknown): value is ProjectRouting =>
  Value.Check(ProjectRoutingSchema, value);
export const DEFAULT_PROJECT_ROUTING: ProjectRouting = { mode: 'browser', basePath: '/' };
export const InitialLayoutVariantSchema = Type.Union([
  Type.Literal('side'),
  Type.Literal('top'),
  Type.Literal('mix'),
]);
export type InitialLayoutVariant = Static<typeof InitialLayoutVariantSchema>;
