import {
  strictObject,
  AgentProtocolVersionSchema,
  AgentRunIdSchema,
  PageIdSchema,
  RequestIdSchema,
  IsoDateTimeSchema,
} from './agent-schema.ts';
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { AgentRunStatusSchema } from './agent-run.ts';
import { PageAgentOutcomeSchema, ClarificationResultSchema } from './agent-outcome.ts';

export const AgentEventSchema = strictObject({
  version: AgentProtocolVersionSchema,
  eventId: Type.Integer({ minimum: 0 }),
  sequence: Type.Integer({ minimum: 0 }),
  type: Type.String({ minLength: 1, maxLength: 128 }),
  runId: AgentRunIdSchema,
  pageId: PageIdSchema,
  requestId: RequestIdSchema,
  occurredAt: IsoDateTimeSchema,
  revisionId: Type.Optional(Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' })),
  payload: Type.Unknown(),
});

export const AgentProgressEventPayloadSchema = strictObject({
  status: AgentRunStatusSchema,
  phase: Type.Union([
    Type.Literal('preparing'),
    Type.Literal('reasoning'),
    Type.Literal('reading'),
    Type.Literal('deciding'),
    Type.Literal('validating'),
    Type.Literal('repairing'),
    Type.Literal('committing'),
  ]),
  message: Type.String({ minLength: 1, maxLength: 200 }),
});

export const AgentRunCompletedEventPayloadSchema = strictObject({
  status: Type.Literal('completed'),
  outcome: PageAgentOutcomeSchema,
  response: Type.Optional(Type.String({ minLength: 1, maxLength: 64_000 })),
  resultWorkingVersion: Type.Optional(Type.Integer({ minimum: 1 })),
});

export const AgentRunFailedEventPayloadSchema = strictObject({
  status: Type.Literal('failed'),
  errorCode: Type.String({ minLength: 1, maxLength: 128 }),
  safeMessage: Type.String({ minLength: 1, maxLength: 2_000 }),
});

export const WorkingCommittedEventPayloadSchema = strictObject({
  baseWorkingVersion: Type.Integer({ minimum: 1 }),
  resultWorkingVersion: Type.Integer({ minimum: 1 }),
  operationCount: Type.Integer({ minimum: 1, maximum: 100 }),
});

export const AgentToolActivityEventPayloadSchema = strictObject({
  toolName: Type.String({ pattern: '^[a-z][a-z0-9_]*$' }),
  phase: Type.Union([
    Type.Literal('started'),
    Type.Literal('completed'),
    Type.Literal('failed'),
    Type.Literal('denied'),
  ]),
  safeErrorCode: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
});

export type AgentEvent = Static<typeof AgentEventSchema>;

export type AgentProgressEventPayload = Static<typeof AgentProgressEventPayloadSchema>;

export type AgentRunCompletedEventPayload = Static<typeof AgentRunCompletedEventPayloadSchema>;

export type AgentRunFailedEventPayload = Static<typeof AgentRunFailedEventPayloadSchema>;

export type WorkingCommittedEventPayload = Static<typeof WorkingCommittedEventPayloadSchema>;

export type AgentToolActivityEventPayload = Static<typeof AgentToolActivityEventPayloadSchema>;

export const ClarificationAvailableEventPayloadSchema = strictObject({
  status: Type.Literal('completed'),
  outcome: Type.Literal('needs_clarification'),
  clarification: ClarificationResultSchema,
});

export type ClarificationAvailableEventPayload = Static<
  typeof ClarificationAvailableEventPayloadSchema
>;
