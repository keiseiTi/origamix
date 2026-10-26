import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import {
  RevisionIdSchema,
  ElementIdSchema,
  PageElementSchema,
  GlobalVariableSchema,
} from './page-schema.ts';
import { FlowIdSchema, PageFlowSchema, ElementEventBindingSchema } from '../flow/flow-schema.ts';

export const ChangeSourceSchema = Type.Union([
  Type.Object({ kind: Type.Literal('user'), actorId: Type.Optional(Type.String()) }),
  Type.Object({
    kind: Type.Literal('agent'),
    runId: Type.String(),
    messageId: Type.Optional(Type.String()),
  }),
  Type.Object({ kind: Type.Literal('restore'), revisionId: RevisionIdSchema }),
]);

const OperationIndexSchema = Type.Integer({ minimum: 0 });

const OperationPropsSchema = Type.Record(Type.String(), Type.Unknown());

export const AddElementOperationSchema = Type.Object(
  {
    operation: Type.Literal('addElement'),
    elementId: ElementIdSchema,
    element: PageElementSchema,
    parentId: ElementIdSchema,
    index: Type.Optional(OperationIndexSchema),
  },
  { additionalProperties: false },
);

export const InsertSubtreeOperationSchema = Type.Object(
  {
    operation: Type.Literal('insertSubtree'),
    rootElementId: ElementIdSchema,
    elements: Type.Record(ElementIdSchema, PageElementSchema),
    structure: Type.Record(ElementIdSchema, Type.Array(ElementIdSchema)),
    parentId: ElementIdSchema,
    index: Type.Optional(OperationIndexSchema),
  },
  { additionalProperties: false },
);

export const RemoveElementOperationSchema = Type.Object(
  {
    operation: Type.Literal('removeElement'),
    elementId: ElementIdSchema,
    removeDescendants: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const MoveElementOperationSchema = Type.Object(
  {
    operation: Type.Literal('moveElement'),
    elementId: ElementIdSchema,
    parentId: ElementIdSchema,
    index: Type.Optional(OperationIndexSchema),
  },
  { additionalProperties: false },
);

export const UpdateElementPropsOperationSchema = Type.Object(
  {
    operation: Type.Literal('updateElementProps'),
    elementId: ElementIdSchema,
    set: Type.Optional(OperationPropsSchema),
    unset: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { uniqueItems: true })),
  },
  { additionalProperties: false },
);

export const ReplaceElementOperationSchema = Type.Object(
  {
    operation: Type.Literal('replaceElement'),
    elementId: ElementIdSchema,
    element: PageElementSchema,
  },
  { additionalProperties: false },
);

export const AddFlowOperationSchema = Type.Object(
  { operation: Type.Literal('addFlow'), flowId: FlowIdSchema, flow: PageFlowSchema },
  { additionalProperties: false },
);

export const UpdateFlowOperationSchema = Type.Object(
  { operation: Type.Literal('updateFlow'), flowId: FlowIdSchema, flow: PageFlowSchema },
  { additionalProperties: false },
);

export const RemoveFlowOperationSchema = Type.Object(
  { operation: Type.Literal('removeFlow'), flowId: FlowIdSchema },
  { additionalProperties: false },
);

export const SetElementBindingsOperationSchema = Type.Object(
  {
    operation: Type.Literal('setElementBindings'),
    bindings: Type.Array(ElementEventBindingSchema),
  },
  { additionalProperties: false },
);

export const SetElementEventBindingOperationSchema = Type.Object(
  {
    operation: Type.Literal('setElementEventBinding'),
    elementId: ElementIdSchema,
    event: Type.String({ minLength: 1 }),
    flowId: FlowIdSchema,
  },
  { additionalProperties: false },
);

export const RemoveElementEventBindingOperationSchema = Type.Object(
  {
    operation: Type.Literal('removeElementEventBinding'),
    elementId: ElementIdSchema,
    event: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const UpdatePageContextOperationSchema = Type.Object(
  {
    operation: Type.Literal('updatePageContext'),
    globalVariables: Type.Array(GlobalVariableSchema),
  },
  { additionalProperties: false },
);

export const SchemaOperationSchema = Type.Union([
  AddElementOperationSchema,
  InsertSubtreeOperationSchema,
  RemoveElementOperationSchema,
  MoveElementOperationSchema,
  UpdateElementPropsOperationSchema,
  ReplaceElementOperationSchema,
  AddFlowOperationSchema,
  UpdateFlowOperationSchema,
  RemoveFlowOperationSchema,
  SetElementBindingsOperationSchema,
  SetElementEventBindingOperationSchema,
  RemoveElementEventBindingOperationSchema,
  UpdatePageContextOperationSchema,
]);

export const SchemaOperationBatchSchema = Type.Object(
  {
    version: Type.Literal('1'),
    pageId: Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' }),
    baseWorkingVersion: Type.Integer({ minimum: 1 }),
    clientRequestId: Type.String({ pattern: '^[A-Za-z0-9_-]{1,100}$' }),
    source: Type.Union([
      Type.Object({ kind: Type.Literal('user') }, { additionalProperties: false }),
      Type.Object(
        {
          kind: Type.Literal('agent'),
          runId: Type.String({ pattern: '^run_[A-Za-z0-9_-]+$' }),
          messageId: Type.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
    ]),
    operations: Type.Array(SchemaOperationSchema, { minItems: 1, maxItems: 200 }),
    createdAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false },
);

export type ChangeSource = Static<typeof ChangeSourceSchema>;

export type SchemaOperation = Static<typeof SchemaOperationSchema>;

export type SchemaOperationBatch = Static<typeof SchemaOperationBatchSchema>;
