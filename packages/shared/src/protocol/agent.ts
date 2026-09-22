import { Type, type Static, type TSchema } from '@sinclair/typebox';
import { SchemaOperationSchema } from './schema';

const strictObject = <T extends Record<string, TSchema>>(properties: T) =>
  Type.Object(properties, { additionalProperties: false });

export const AgentProtocolVersionSchema = Type.Literal('1');
export const AgentRunIdSchema = Type.String({ pattern: '^run_[A-Za-z0-9_-]+$' });
export const ConversationIdSchema = Type.String({ pattern: '^conversation_[A-Za-z0-9_-]+$' });
export const MessageIdSchema = Type.String({ pattern: '^message_[A-Za-z0-9_-]+$' });
export const PageIdSchema = Type.String({ pattern: '^page_[A-Za-z0-9_-]+$' });
export const RequestIdSchema = Type.String({ minLength: 1, maxLength: 128 });
export const IsoDateTimeSchema = Type.String({ format: 'date-time' });
export const AgentRunKindSchema = Type.Literal('page_assistant');

export const ClarificationCandidateSchema = strictObject({
  elementId: Type.String({ pattern: '^[A-Za-z][A-Za-z0-9_-]*$' }),
  label: Type.String({ minLength: 1, maxLength: 120 }),
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

export const RuntimeDiagnosticSchema = strictObject({
  code: Type.String({ minLength: 1, maxLength: 128 }),
  severity: Type.Union([Type.Literal('warning'), Type.Literal('error')]),
  stage: Type.Union([
    Type.Literal('load'),
    Type.Literal('material'),
    Type.Literal('expression'),
    Type.Literal('render'),
    Type.Literal('event'),
  ]),
  pageId: PageIdSchema,
  revisionId: Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' }),
  elementId: Type.Optional(Type.String({ pattern: '^[A-Za-z][A-Za-z0-9_-]*$' })),
  materialType: Type.Optional(Type.String({ minLength: 1 })),
  safeMessage: Type.String({ minLength: 1, maxLength: 2_000 }),
});

export const RuntimeRenderReportSchema = strictObject({
  version: AgentProtocolVersionSchema,
  projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
  pageId: PageIdSchema,
  revisionId: Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' }),
  outcome: Type.Union([Type.Literal('success'), Type.Literal('failed')]),
  diagnostics: Type.Array(RuntimeDiagnosticSchema, { maxItems: 50 }),
  observedAt: IsoDateTimeSchema,
});

export const RuntimeReportResultSchema = strictObject({
  version: AgentProtocolVersionSchema,
  disposition: Type.Union([Type.Literal('accepted'), Type.Literal('stale')]),
  currentRevisionId: Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' }),
  visualRevisionId: Type.Optional(Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' })),
});

export const PageRuntimeStateSchema = strictObject({
  version: AgentProtocolVersionSchema,
  projectId: Type.String({ pattern: '^project_[A-Za-z0-9_-]+$' }),
  pageId: PageIdSchema,
  currentRevisionId: Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' }),
  lastKnownGoodRevisionId: Type.Optional(Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' })),
  visualRevisionId: Type.Optional(Type.String({ pattern: '^revision_[A-Za-z0-9_-]+$' })),
  diagnostics: Type.Array(RuntimeDiagnosticSchema),
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
  resultWorkingVersion: Type.Optional(Type.Integer({ minimum: 1 })),
});

export const AgentRunFailedEventPayloadSchema = strictObject({
  status: Type.Literal('failed'),
  errorCode: Type.String({ minLength: 1, maxLength: 128 }),
  safeMessage: Type.String({ minLength: 1, maxLength: 2_000 }),
});

export const ClarificationAvailableEventPayloadSchema = strictObject({
  status: Type.Literal('completed'),
  outcome: Type.Literal('needs_clarification'),
  clarification: ClarificationResultSchema,
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
  conversationId: ConversationIdSchema,
  userMessageId: MessageIdSchema,
  runKind: AgentRunKindSchema,
  status: AgentRunStatusSchema,
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

export const AgentEvaluationCaseResultSchema = strictObject({
  caseId: Type.String({ pattern: '^eval_[a-z0-9_]+$' }),
  passed: Type.Boolean(),
  expectedOutcome: Type.Optional(PageAgentOutcomeSchema),
  actualOutcome: Type.Optional(PageAgentOutcomeSchema),
  status: AgentRunStatusSchema,
  firstEventMs: Type.Integer({ minimum: 0 }),
  durationMs: Type.Integer({ minimum: 0 }),
  inputTokens: Type.Integer({ minimum: 0 }),
  outputTokens: Type.Integer({ minimum: 0 }),
  modelCalls: Type.Integer({ minimum: 0 }),
  toolCalls: Type.Integer({ minimum: 0 }),
  schemaBytes: Type.Integer({ minimum: 0 }),
  repairAttempts: Type.Integer({ minimum: 0 }),
  terminalDecisionAttempts: Type.Integer({ minimum: 0 }),
  successfulWorkingCommits: Type.Integer({ minimum: 0 }),
  successResponsePublished: Type.Boolean(),
  errorStage: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
  toolTrace: Type.Array(Type.String({ minLength: 1, maxLength: 128 })),
  failures: Type.Array(Type.String({ minLength: 1, maxLength: 2_000 })),
});

export const AgentEvaluationReportSchema = strictObject({
  version: AgentProtocolVersionSchema,
  adapter: Type.Union([Type.Literal('fake'), Type.Literal('recorded'), Type.Literal('real')]),
  suiteVersion: Type.String({ minLength: 1, maxLength: 64 }),
  startedAt: IsoDateTimeSchema,
  finishedAt: IsoDateTimeSchema,
  passed: Type.Boolean(),
  summary: strictObject({
    total: Type.Integer({ minimum: 0 }),
    passed: Type.Integer({ minimum: 0 }),
    successRate: Type.Number({ minimum: 0, maximum: 1 }),
    firstTerminalSuccessRate: Type.Number({ minimum: 0, maximum: 1 }),
    repairRate: Type.Number({ minimum: 0, maximum: 1 }),
    repairSuccessRate: Type.Number({ minimum: 0, maximum: 1 }),
    missingTerminalDecisionRate: Type.Number({ minimum: 0, maximum: 1 }),
    workingConflictRate: Type.Number({ minimum: 0, maximum: 1 }),
    recoveredCommitCount: Type.Integer({ minimum: 0 }),
    outcomeCounts: Type.Record(Type.String(), Type.Integer({ minimum: 0 })),
    p50DurationMs: Type.Integer({ minimum: 0 }),
    p95FirstEventMs: Type.Integer({ minimum: 0 }),
    p95DurationMs: Type.Integer({ minimum: 0 }),
    p50ModelCalls: Type.Integer({ minimum: 0 }),
    p95ModelCalls: Type.Integer({ minimum: 0 }),
    p50ToolCalls: Type.Integer({ minimum: 0 }),
    p95ToolCalls: Type.Integer({ minimum: 0 }),
    p50Tokens: Type.Integer({ minimum: 0 }),
    p95Tokens: Type.Integer({ minimum: 0 }),
    totalInputTokens: Type.Integer({ minimum: 0 }),
    totalOutputTokens: Type.Integer({ minimum: 0 }),
    totalToolCalls: Type.Integer({ minimum: 0 }),
    peakSchemaBytes: Type.Integer({ minimum: 0 }),
  }),
  cases: Type.Array(AgentEvaluationCaseResultSchema),
});

export type AgentRunKind = Static<typeof AgentRunKindSchema>;
export type ClarificationCandidate = Static<typeof ClarificationCandidateSchema>;
export type CompletePageRunInput = Static<typeof CompletePageRunInputSchema>;
export type PageAgentOutcome = Static<typeof PageAgentOutcomeSchema>;
export type ClarificationResult = Static<typeof ClarificationResultSchema>;
export type ClarificationSelection = Static<typeof ClarificationSelectionSchema>;
export type OperationValidationFailure = Static<typeof OperationValidationFailureSchema>;
export type AgentRunStatus = Static<typeof AgentRunStatusSchema>;
export type RunBudget = Static<typeof RunBudgetSchema>;
export type ToolPolicy = Static<typeof ToolPolicySchema>;
export type RuntimeDiagnostic = Static<typeof RuntimeDiagnosticSchema>;
export type RuntimeRenderReport = Static<typeof RuntimeRenderReportSchema>;
export type RuntimeReportResult = Static<typeof RuntimeReportResultSchema>;
export type PageRuntimeState = Static<typeof PageRuntimeStateSchema>;
export type AgentRun = Static<typeof AgentRunSchema>;
export type MessageContentBlock = Static<typeof MessageContentBlockSchema>;
export type MessageContent = Static<typeof MessageContentSchema>;
export type AgentMessage = Static<typeof AgentMessageSchema>;
export type AgentEvent = Static<typeof AgentEventSchema>;
export type AgentProgressEventPayload = Static<typeof AgentProgressEventPayloadSchema>;
export type AgentRunCompletedEventPayload = Static<typeof AgentRunCompletedEventPayloadSchema>;
export type AgentRunFailedEventPayload = Static<typeof AgentRunFailedEventPayloadSchema>;
export type ClarificationAvailableEventPayload = Static<
  typeof ClarificationAvailableEventPayloadSchema
>;
export type WorkingCommittedEventPayload = Static<typeof WorkingCommittedEventPayloadSchema>;
export type AgentToolActivityEventPayload = Static<typeof AgentToolActivityEventPayloadSchema>;
export type CreateAgentRunRequest = Static<typeof CreateAgentRunRequestSchema>;
export type CreateAgentRunResponse = Static<typeof CreateAgentRunResponseSchema>;
export type Conversation = Static<typeof ConversationSchema>;
export type ListConversationsResponse = Static<typeof ListConversationsResponseSchema>;
export type ListMessagesResponse = Static<typeof ListMessagesResponseSchema>;
export type GetAgentRunRequest = Static<typeof GetAgentRunRequestSchema>;
export type GetAgentRunResponse = Static<typeof GetAgentRunResponseSchema>;
export type SubscribeAgentEventsRequest = Static<typeof SubscribeAgentEventsRequestSchema>;
export type CancelAgentRunRequest = Static<typeof CancelAgentRunRequestSchema>;
export type CancelAgentRunResponse = Static<typeof CancelAgentRunResponseSchema>;
export type AgentErrorPayload = Static<typeof AgentErrorPayloadSchema>;
export type AgentEvaluationCaseResult = Static<typeof AgentEvaluationCaseResultSchema>;
export type AgentEvaluationReport = Static<typeof AgentEvaluationReportSchema>;
