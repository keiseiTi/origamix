import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import {
  strictObject,
  AgentProtocolVersionSchema,
  AgentRunIdSchema,
  PageIdSchema,
  ConversationIdSchema,
  MessageIdSchema,
  RequestIdSchema,
  IsoDateTimeSchema,
} from './agent-schema.ts';
import { PageAgentOutcomeSchema, ClarificationResultSchema } from './agent-outcome.ts';

export const AgentRunKindSchema = Type.Literal('page_assistant');

export const AgentRunStatusSchema = Type.Union([
  Type.Literal('queued'),
  Type.Literal('preparing'),
  Type.Literal('reasoning'),
  Type.Literal('reading'),
  Type.Literal('validating'),
  Type.Literal('repairing'),
  Type.Literal('committing'),
  Type.Literal('deciding'),
  Type.Literal('cancelling'),
  Type.Literal('completed'),
  Type.Literal('failed'),
  Type.Literal('cancelled'),
  Type.Literal('interrupted'),
]);

export const RunBudgetSchema = strictObject({
  maxModelCalls: Type.Integer({ minimum: 1 }),
  maxToolCalls: Type.Integer({ minimum: 1 }),
  maxOutputTokens: Type.Integer({ minimum: 1 }),
  maxDurationMs: Type.Integer({ minimum: 1 }),
  maxSchemaBytes: Type.Integer({ minimum: 1 }),
  maxRepairAttempts: Type.Integer({ minimum: 0 }),
});

export const ToolPolicySchema = strictObject({
  toolName: Type.String({ pattern: '^[a-z][a-z0-9_]*$' }),
  scope: Type.Union([Type.Literal('read'), Type.Literal('page_write')]),
  risk: Type.Union([Type.Literal('low'), Type.Literal('medium'), Type.Literal('high')]),
  requiresConfirmation: Type.Boolean(),
});

export const AgentRunSchema = strictObject({
  version: AgentProtocolVersionSchema,
  runId: AgentRunIdSchema,
  projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
  pageId: PageIdSchema,
  conversationId: ConversationIdSchema,
  userMessageId: MessageIdSchema,
  requestId: RequestIdSchema,
  baseWorkingVersion: Type.Integer({ minimum: 1 }),
  runKind: AgentRunKindSchema,
  status: AgentRunStatusSchema,
  budget: RunBudgetSchema,
  modelRef: Type.String({ minLength: 1 }),
  promptVersion: Type.String({ minLength: 1 }),
  policyVersion: Type.String({ minLength: 1 }),
  toolsetVersion: Type.String({ minLength: 1 }),
  materialManifestVersion: Type.String({ minLength: 1 }),
  outcome: Type.Optional(PageAgentOutcomeSchema),
  clarification: Type.Optional(ClarificationResultSchema),
  repairAttempts: Type.Optional(Type.Integer({ minimum: 0 })),
  resultWorkingVersion: Type.Optional(Type.Integer({ minimum: 1 })),
  resultWorkingHash: Type.Optional(Type.String({ pattern: '^[a-f0-9]{64}$' })),
  retryOfRunId: Type.Optional(AgentRunIdSchema),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export type AgentRunKind = Static<typeof AgentRunKindSchema>;

export type AgentRunStatus = Static<typeof AgentRunStatusSchema>;

export type RunBudget = Static<typeof RunBudgetSchema>;

export type ToolPolicy = Static<typeof ToolPolicySchema>;

export type AgentRun = Static<typeof AgentRunSchema>;
