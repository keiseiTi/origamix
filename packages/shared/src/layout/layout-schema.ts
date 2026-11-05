import { Type, type Static } from '@sinclair/typebox';
import { PageSchema } from '../page/page-schema.ts';

import { LAYOUT_SCHEMA_VERSION, SCHEMA_VERSION } from '../version.ts';

/** Independent persisted contract; existing page schemas are not migrated. */
export { LAYOUT_SCHEMA_VERSION } from '../version.ts';
export const PAGE_OUTLET_TYPE = 'PageOutlet' as const;
export const PAGE_NAVIGATION_TYPE = 'PageNavigation' as const;
export const LAYOUT_NAME = '布局配置' as const;
export const LayoutProjectIdSchema = Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' });
export const LayoutPageIdSchema = Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' });

/** System-owned occupancy properties, consumed by the shared Runtime frame. */
export const PageOutletPropsSchema = Type.Object(
  {
    alias: Type.Optional(Type.String({ maxLength: 80 })),
    layoutWidth: Type.Optional(
      Type.Union([Type.Literal('auto'), Type.Literal('fill'), Type.Literal('fixed')]),
    ),
    layoutHeight: Type.Optional(
      Type.Union([Type.Literal('auto'), Type.Literal('fill'), Type.Literal('fixed')]),
    ),
    layoutFixedWidth: Type.Optional(Type.Number({ minimum: 0 })),
    layoutFixedHeight: Type.Optional(Type.Number({ minimum: 0 })),
    layoutGrow: Type.Optional(Type.Number({ minimum: 0 })),
    layoutAlignSelf: Type.Optional(
      Type.Union([
        Type.Literal('auto'),
        Type.Literal('flex-start'),
        Type.Literal('center'),
        Type.Literal('flex-end'),
        Type.Literal('stretch'),
      ]),
    ),
  },
  { additionalProperties: false },
);

/** Optional system navigation uses the application page directory, never arbitrary URLs. */
export const PageNavigationPropsSchema = Type.Object(
  {
    ...PageOutletPropsSchema.properties,
    direction: Type.Optional(Type.Union([Type.Literal('horizontal'), Type.Literal('vertical')])),
  },
  { additionalProperties: false },
);

// Node structure and operations remain shared with pages; layout adds semantic constraints.
export const LayoutSchema = PageSchema;
export const ProjectLayoutDocumentSchema = Type.Object(
  {
    schemaVersion: Type.Literal(LAYOUT_SCHEMA_VERSION),
    projectId: LayoutProjectIdSchema,
    schema: LayoutSchema,
  },
  { additionalProperties: false },
);
/** Project-wide composition only. No page-level override or multiple-layout selection. */
export const ApplicationLayoutSchema = Type.Union([
  Type.Object({ enabled: Type.Literal(false) }, { additionalProperties: false }),
  Type.Object(
    { enabled: Type.Literal(true), document: ProjectLayoutDocumentSchema },
    { additionalProperties: false },
  ),
]);
export type ApplicationLayout = Static<typeof ApplicationLayoutSchema>;

export const SessionTargetSchema = Type.Union([
  Type.Object(
    { kind: Type.Literal('page'), projectId: LayoutProjectIdSchema, pageId: LayoutPageIdSchema },
    { additionalProperties: false },
  ),
  Type.Object(
    { kind: Type.Literal('layout'), projectId: LayoutProjectIdSchema },
    { additionalProperties: false },
  ),
]);
/** Contract for future target-aware Runs; current page Run transport stays page-only. */
export const AgentTargetSchema = SessionTargetSchema;
export const LayoutFocusSchema = Type.Object(
  {
    selectedElementIds: Type.Optional(
      Type.Array(Type.String({ pattern: '^[A-Za-z][A-Za-z0-9_-]*$' }), { uniqueItems: true }),
    ),
  },
  { additionalProperties: false },
);
export type LayoutSchema = Static<typeof LayoutSchema>;
export type ProjectLayoutDocument = Static<typeof ProjectLayoutDocumentSchema>;
export type SessionTarget = Static<typeof SessionTargetSchema>;
export type AgentTarget = SessionTarget;
export type LayoutFocus = Static<typeof LayoutFocusSchema>;

export const createEmptyLayoutDocument = (projectId: string): ProjectLayoutDocument => ({
  schemaVersion: LAYOUT_SCHEMA_VERSION,
  projectId,
  schema: {
    elements: { outlet: { type: PAGE_OUTLET_TYPE, props: {} } },
    layout: { root: 'outlet', structure: { outlet: [] } },
    flows: {},
    bindElements: [],
    context: { globalVariables: [] },
    extensions: { origamix: { schemaVersion: SCHEMA_VERSION } },
  },
});
