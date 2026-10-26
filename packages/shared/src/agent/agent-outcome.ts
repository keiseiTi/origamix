import { strictObject, AgentRunIdSchema } from './agent-schema.ts';
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { SchemaOperationSchema } from '../page/schema-operation.ts';

export const ClarificationCandidateSchema = strictObject({
  elementId: Type.String({ pattern: '^[A-Za-z][A-Za-z0-9_-]*$' }),
  label: Type.String({ minLength: 1 }),
  description: Type.Optional(Type.String({ minLength: 1, maxLength: 500 })),
});

export const CompletePageRunInputSchema = Type.Union([
  strictObject({
    outcome: Type.Literal('apply_changes'),
    operations: Type.Array(SchemaOperationSchema, { minItems: 1, maxItems: 100 }),
    response: Type.String({ minLength: 1, maxLength: 20_000 }),
    answeredQuestion: Type.Optional(Type.Boolean()),
  }),
  strictObject({
    outcome: Type.Literal('answer_only'),
    response: Type.String({ minLength: 1, maxLength: 20_000 }),
  }),
  strictObject({
    outcome: Type.Literal('no_change_needed'),
    reason: Type.String({ minLength: 1, maxLength: 2_000 }),
    response: Type.String({ minLength: 1, maxLength: 20_000 }),
  }),
  strictObject({
    outcome: Type.Literal('needs_clarification'),
    question: Type.String({ minLength: 1, maxLength: 2_000 }),
    candidates: Type.Optional(Type.Array(ClarificationCandidateSchema, { maxItems: 8 })),
  }),
  strictObject({
    outcome: Type.Literal('refused'),
    reasonCode: Type.String({ pattern: '^[A-Z][A-Z0-9_]{0,127}$' }),
    response: Type.String({ minLength: 1, maxLength: 20_000 }),
  }),
]);

/**
 * Provider-facing function parameters must have an object at the JSON Schema root.
 * The Server still validates tool input with CompletePageRunInputSchema so the
 * conditional requirements for each outcome remain authoritative.
 */
export const CompletePageRunToolParametersSchema = strictObject({
  outcome: Type.Union([
    Type.Literal('apply_changes'),
    Type.Literal('answer_only'),
    Type.Literal('no_change_needed'),
    Type.Literal('needs_clarification'),
    Type.Literal('refused'),
  ]),
  operations: Type.Optional(Type.Array(SchemaOperationSchema, { minItems: 1, maxItems: 100 })),
  response: Type.Optional(Type.String({ minLength: 1, maxLength: 20_000 })),
  answeredQuestion: Type.Optional(Type.Boolean()),
  reason: Type.Optional(Type.String({ minLength: 1, maxLength: 2_000 })),
  question: Type.Optional(Type.String({ minLength: 1, maxLength: 2_000 })),
  candidates: Type.Optional(Type.Array(ClarificationCandidateSchema, { maxItems: 8 })),
  reasonCode: Type.Optional(Type.String({ pattern: '^[A-Z][A-Z0-9_]{0,127}$' })),
});

export const PageAgentOutcomeSchema = Type.Union([
  Type.Literal('changed'),
  Type.Literal('changed_and_answered'),
  Type.Literal('answered_only'),
  Type.Literal('no_change_needed'),
  Type.Literal('needs_clarification'),
  Type.Literal('refused'),
]);

export const ClarificationResultSchema = strictObject({
  clarificationId: Type.String({ pattern: '^clarification_[A-Za-z0-9_-]+$' }),
  baseWorkingVersion: Type.Integer({ minimum: 1 }),
  question: Type.String({ minLength: 1, maxLength: 2_000 }),
  candidates: Type.Optional(Type.Array(ClarificationCandidateSchema, { maxItems: 8 })),
});

export const ClarificationSelectionSchema = strictObject({
  runId: AgentRunIdSchema,
  clarificationId: Type.String({ pattern: '^clarification_[A-Za-z0-9_-]+$' }),
  selectedElementId: Type.String({ pattern: '^[A-Za-z][A-Za-z0-9_-]*$' }),
});

export const OperationValidationFailureSchema = strictObject({
  code: Type.Union([
    Type.Literal('INVALID_OPERATION'),
    Type.Literal('ELEMENT_NOT_FOUND'),
    Type.Literal('INVALID_PARENT'),
    Type.Literal('INVALID_MATERIAL'),
    Type.Literal('INVALID_PROPS'),
    Type.Literal('SCHEMA_INVALID'),
    Type.Literal('WORKING_VERSION_CONFLICT'),
  ]),
  operationIndex: Type.Optional(Type.Integer({ minimum: 0, maximum: 99 })),
  elementId: Type.Optional(Type.String({ pattern: '^[A-Za-z][A-Za-z0-9_-]*$' })),
  materialType: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
  field: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  message: Type.String({ minLength: 1, maxLength: 2_000 }),
  retryable: Type.Boolean(),
});

export type ClarificationCandidate = Static<typeof ClarificationCandidateSchema>;

export type CompletePageRunInput = Static<typeof CompletePageRunInputSchema>;

export type PageAgentOutcome = Static<typeof PageAgentOutcomeSchema>;

export type ClarificationResult = Static<typeof ClarificationResultSchema>;

export type ClarificationSelection = Static<typeof ClarificationSelectionSchema>;

export type OperationValidationFailure = Static<typeof OperationValidationFailureSchema>;
