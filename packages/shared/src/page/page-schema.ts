import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { PageFlowSchema, FlowIdSchema, ElementEventBindingSchema } from '../flow/flow-schema.ts';
import { ORIGAMIX_VERSION } from '../version.ts';

// Element identities remain stable across editor commands and persisted drafts.
export const ElementIdSchema = Type.String({ pattern: '^[A-Za-z][A-Za-z0-9_-]*$' });

export const RevisionIdSchema = Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' });

export const PageElementSchema = Type.Object({
  type: Type.String({ minLength: 1 }),
  props: Type.Record(Type.String(), Type.Unknown()),
});

export const GlobalVariableSchema = Type.Object({
  name: Type.String(),
  description: Type.Optional(Type.String()),
  type: Type.Optional(Type.String()),
  defaultValue: Type.Optional(Type.Unknown()),
});

export type GlobalVariable = Static<typeof GlobalVariableSchema>;

export const PageSchema = Type.Object({
  elements: Type.Record(ElementIdSchema, PageElementSchema),
  layout: Type.Object({
    root: ElementIdSchema,
    structure: Type.Record(ElementIdSchema, Type.Array(ElementIdSchema)),
  }),
  flows: Type.Record(Type.String(), PageFlowSchema, { propertyNames: FlowIdSchema }),
  bindElements: Type.Array(ElementEventBindingSchema),
  context: Type.Object({ globalVariables: Type.Array(GlobalVariableSchema) }),
  extensions: Type.Object({
    flowGraph: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
    origamix: Type.Object({ schemaVersion: Type.Literal(ORIGAMIX_VERSION) }),
  }),
});

export type OrigamixPageSchema = Static<typeof PageSchema>;

/** Editor labels use aliases first, then the localized material title. IDs remain the mutation identity. */
export const getElementLabel = (
  elementId: string,
  element?: { type?: string; props?: Record<string, unknown> },
  materialTitle?: string,
): string => {
  const alias = element?.props?.alias;
  return typeof alias === 'string' && alias.trim()
    ? alias
    : materialTitle || element?.type || elementId;
};

/** Agent references keep unaliased elements distinguishable by their stable ID. */
export const getAgentElementLabel = (
  elementId: string,
  element?: { type?: string; props?: Record<string, unknown> },
  materialTitle?: string,
): string => {
  const alias = element?.props?.alias;
  return typeof alias === 'string' && alias.trim()
    ? alias
    : element?.type
      ? `${elementId}（${materialTitle || element.type}）`
      : elementId;
};
