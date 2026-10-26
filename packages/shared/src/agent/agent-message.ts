import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import {
  strictObject,
  PageIdSchema,
  AgentProtocolVersionSchema,
  MessageIdSchema,
  ConversationIdSchema,
  AgentRunIdSchema,
  IsoDateTimeSchema,
} from './agent-schema.ts';
import { RuntimeDiagnosticSchema } from './runtime-report.ts';

export const MessageContentBlockSchema = Type.Union([
  strictObject({ type: Type.Literal('text'), text: Type.String() }),
  strictObject({
    type: Type.Literal('page_reference'),
    pageId: PageIdSchema,
    revisionId: Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' }),
  }),
  strictObject({
    type: Type.Literal('element_reference'),
    pageId: PageIdSchema,
    elementIds: Type.Array(Type.String({ pattern: '^[A-Za-z][A-Za-z0-9_-]*$' }), {
      minItems: 1,
      uniqueItems: true,
    }),
  }),
  strictObject({
    type: Type.Literal('change_summary'),
    revisionId: Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' }),
    summary: Type.String({ minLength: 1 }),
  }),
  strictObject({
    type: Type.Literal('tool_call'),
    toolCallId: Type.String({ minLength: 1 }),
    toolName: Type.String({ minLength: 1 }),
    inputSummary: Type.Unknown(),
  }),
  strictObject({
    type: Type.Literal('tool_result'),
    toolCallId: Type.String({ minLength: 1 }),
    status: Type.Union([Type.Literal('success'), Type.Literal('failed')]),
  }),
  Type.Composite([RuntimeDiagnosticSchema, strictObject({ type: Type.Literal('diagnostic') })]),
  strictObject({
    type: Type.Literal('image_reference'),
    artifactId: Type.String({ minLength: 1 }),
  }),
]);

export const MessageContentSchema = strictObject({
  version: AgentProtocolVersionSchema,
  blocks: Type.Array(MessageContentBlockSchema, { minItems: 1 }),
});

export const AgentMessageSchema = strictObject({
  version: AgentProtocolVersionSchema,
  messageId: MessageIdSchema,
  conversationId: ConversationIdSchema,
  runId: Type.Optional(AgentRunIdSchema),
  role: Type.Union([Type.Literal('user'), Type.Literal('assistant'), Type.Literal('system')]),
  content: MessageContentSchema,
  sequence: Type.Integer({ minimum: 0 }),
  createdAt: IsoDateTimeSchema,
});

export const ConversationSchema = strictObject({
  version: AgentProtocolVersionSchema,
  conversationId: ConversationIdSchema,
  projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
  pageId: PageIdSchema,
  title: Type.String({ minLength: 1, maxLength: 500 }),
  status: Type.Union([Type.Literal('active'), Type.Literal('archived')]),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export type MessageContentBlock = Static<typeof MessageContentBlockSchema>;

export type MessageContent = Static<typeof MessageContentSchema>;

export type AgentMessage = Static<typeof AgentMessageSchema>;

export type Conversation = Static<typeof ConversationSchema>;
