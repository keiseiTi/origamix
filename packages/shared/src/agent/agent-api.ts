import {
  strictObject,
  AgentProtocolVersionSchema,
  PageIdSchema,
  ConversationIdSchema,
  RequestIdSchema,
  AgentRunIdSchema,
  MessageIdSchema,
} from './agent-schema.ts';
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { MessageContentSchema, ConversationSchema, AgentMessageSchema } from './agent-message.ts';
import { ClarificationSelectionSchema } from './agent-outcome.ts';
import { AgentRunSchema, AgentRunKindSchema, AgentRunStatusSchema } from './agent-run.ts';

export const CreateAgentRunRequestSchema = strictObject({
  version: AgentProtocolVersionSchema,
  projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
  pageId: PageIdSchema,
  conversationId: Type.Optional(ConversationIdSchema),
  clientRequestId: RequestIdSchema,
  baseWorkingVersion: Type.Integer({ minimum: 1 }),
  content: MessageContentSchema,
  clarification: Type.Optional(ClarificationSelectionSchema),
  retryOfRunId: Type.Optional(AgentRunIdSchema),
});

export const CreateAgentRunResponseSchema = strictObject({
  version: AgentProtocolVersionSchema,
  runId: AgentRunIdSchema,
  run: AgentRunSchema,
  conversationId: ConversationIdSchema,
  userMessageId: MessageIdSchema,
  runKind: AgentRunKindSchema,
  status: AgentRunStatusSchema,
});

export const ListConversationsResponseSchema = strictObject({
  version: AgentProtocolVersionSchema,
  conversations: Type.Array(ConversationSchema),
});

export const ListMessagesResponseSchema = strictObject({
  version: AgentProtocolVersionSchema,
  messages: Type.Array(AgentMessageSchema),
});

export const GetAgentRunResponseSchema = strictObject({
  version: AgentProtocolVersionSchema,
  run: AgentRunSchema,
});

export const GetAgentRunRequestSchema = strictObject({
  version: AgentProtocolVersionSchema,
  runId: AgentRunIdSchema,
});

export const SubscribeAgentEventsRequestSchema = strictObject({
  version: AgentProtocolVersionSchema,
  runId: AgentRunIdSchema,
  afterEventId: Type.Optional(Type.Integer({ minimum: 0 })),
});

export const CancelAgentRunRequestSchema = strictObject({
  version: AgentProtocolVersionSchema,
  requestId: RequestIdSchema,
});

export const CancelAgentRunResponseSchema = strictObject({
  version: AgentProtocolVersionSchema,
  runId: AgentRunIdSchema,
  status: Type.Union([
    Type.Literal('committing'),
    Type.Literal('cancelling'),
    Type.Literal('cancelled'),
  ]),
});

export const AgentErrorPayloadSchema = strictObject({
  code: Type.Union([
    Type.Literal('INVALID_REQUEST'),
    Type.Literal('RUN_NOT_FOUND'),
    Type.Literal('RUN_CONFLICT'),
    Type.Literal('REVISION_CONFLICT'),
    Type.Literal('BUDGET_EXCEEDED'),
    Type.Literal('PROVIDER_ERROR'),
    Type.Literal('TOOL_ERROR'),
    Type.Literal('INTERNAL_ERROR'),
  ]),
  safeMessage: Type.String({ minLength: 1, maxLength: 2_000 }),
  retryable: Type.Boolean(),
});

export type CreateAgentRunRequest = Static<typeof CreateAgentRunRequestSchema>;

export type CreateAgentRunResponse = Static<typeof CreateAgentRunResponseSchema>;

export type ListConversationsResponse = Static<typeof ListConversationsResponseSchema>;

export type ListMessagesResponse = Static<typeof ListMessagesResponseSchema>;

export type GetAgentRunRequest = Static<typeof GetAgentRunRequestSchema>;

export type GetAgentRunResponse = Static<typeof GetAgentRunResponseSchema>;

export type SubscribeAgentEventsRequest = Static<typeof SubscribeAgentEventsRequestSchema>;

export type CancelAgentRunRequest = Static<typeof CancelAgentRunRequestSchema>;

export type CancelAgentRunResponse = Static<typeof CancelAgentRunResponseSchema>;

export type AgentErrorPayload = Static<typeof AgentErrorPayloadSchema>;
