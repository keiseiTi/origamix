import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

// IDs remain compatible with engine-generated IDs; reserved object keys are not identities.
export const FlowIdSchema = Type.String({
  minLength: 1,
  not: { enum: ['__proto__', 'prototype', 'constructor'] },
});

export const PageFlowNodeSchema = Type.Object(
  {
    id: FlowIdSchema,
    type: Type.String({ minLength: 1 }),
    props: Type.Record(Type.String(), Type.Unknown()),
    prev: Type.Array(FlowIdSchema),
    next: Type.Array(FlowIdSchema),
  },
  { additionalProperties: false },
);

export const PageFlowSchema = Type.Object(
  {
    startId: FlowIdSchema,
    nodes: Type.Record(Type.String(), PageFlowNodeSchema, { propertyNames: FlowIdSchema }),
  },
  { additionalProperties: false },
);

export const ElementEventBindingSchema = Type.Object(
  {
    id: Type.String({ pattern: '^[A-Za-z][A-Za-z0-9_-]*$' }),
    event: Type.String({ minLength: 1 }),
    flowId: FlowIdSchema,
  },
  { additionalProperties: false },
);

export type PageFlow = Static<typeof PageFlowSchema>;

export type PageFlowNode = Static<typeof PageFlowNodeSchema>;

export type ElementEventBinding = Static<typeof ElementEventBindingSchema>;
