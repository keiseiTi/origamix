export {
  CredentialGatewayVersionSchema,
  CredentialReferenceSchema,
  CredentialPurposeSchema,
  CredentialRequestSchema,
  CredentialSuccessResponseSchema,
  CredentialFailureResponseSchema,
  CredentialResponseSchema,
  isCredentialRequest,
  isCredentialResponse,
} from './credential-gateway.ts';

export type {
  CredentialReference,
  CredentialPurpose,
  CredentialRequest,
  CredentialResponse,
} from './credential-gateway.ts';

export type {
  BackendConnection,
  DirectoryGrant,
  UserProfile,
  ModelSettings,
  DesktopApi,
} from './desktop-api.ts';

export { PreviewRenderDiagnosticSchema, PreviewRenderReportSchema } from './page-window.ts';

export type {
  PreviewSnapshot,
  PreviewRenderDiagnostic,
  PreviewRenderReport,
} from './page-window.ts';

export {
  validateAgentRun,
  validateRunBudget,
  validateToolPolicy,
  validateMessageContent,
  validateAgentMessage,
  validateAgentEvent,
  validateRuntimeDiagnostic,
  validateRuntimeRenderReport,
  validateRuntimeReportResult,
  validatePageRuntimeState,
  validateCreateAgentRunRequest,
  validateCreateAgentRunResponse,
  validateGetAgentRunRequest,
  validateGetAgentRunResponse,
  validateSubscribeAgentEventsRequest,
  validateCancelAgentRunRequest,
  validateCancelAgentRunResponse,
  validateAgentErrorPayload,
  validateListConversationsResponse,
  validateListMessagesResponse,
  validateAgentEvaluationReport,
  validateCompletePageRunInput,
  validatePageAgentOutcome,
  validateClarificationResult,
  validateOperationValidationFailure,
} from './protocol/agent-validation.ts';

export type { AgentProtocolValidationResult } from './protocol/agent-validation.ts';

export {
  AgentProtocolVersionSchema,
  AgentRunIdSchema,
  ConversationIdSchema,
  MessageIdSchema,
  PageIdSchema,
  RequestIdSchema,
  IsoDateTimeSchema,
  AgentRunKindSchema,
  ClarificationCandidateSchema,
  CompletePageRunInputSchema,
  CompletePageRunToolParametersSchema,
  PageAgentOutcomeSchema,
  ClarificationResultSchema,
  ClarificationSelectionSchema,
  OperationValidationFailureSchema,
  AgentRunStatusSchema,
  RunBudgetSchema,
  ToolPolicySchema,
  RuntimeDiagnosticSchema,
  RuntimeRenderReportSchema,
  RuntimeReportResultSchema,
  PageRuntimeStateSchema,
  AgentRunSchema,
  MessageContentBlockSchema,
  MessageContentSchema,
  AgentMessageSchema,
  AgentEventSchema,
  AgentProgressEventPayloadSchema,
  AgentRunCompletedEventPayloadSchema,
  AgentRunFailedEventPayloadSchema,
  ClarificationAvailableEventPayloadSchema,
  WorkingCommittedEventPayloadSchema,
  AgentToolActivityEventPayloadSchema,
  CreateAgentRunRequestSchema,
  CreateAgentRunResponseSchema,
  ConversationSchema,
  ListConversationsResponseSchema,
  ListMessagesResponseSchema,
  GetAgentRunResponseSchema,
  GetAgentRunRequestSchema,
  SubscribeAgentEventsRequestSchema,
  CancelAgentRunRequestSchema,
  CancelAgentRunResponseSchema,
  AgentErrorPayloadSchema,
  AgentEvaluationCaseResultSchema,
  AgentEvaluationReportSchema,
} from './protocol/agent.ts';

export type {
  AgentRunKind,
  ClarificationCandidate,
  CompletePageRunInput,
  PageAgentOutcome,
  ClarificationResult,
  ClarificationSelection,
  OperationValidationFailure,
  AgentRunStatus,
  RunBudget,
  ToolPolicy,
  RuntimeDiagnostic,
  RuntimeRenderReport,
  RuntimeReportResult,
  PageRuntimeState,
  AgentRun,
  MessageContentBlock,
  MessageContent,
  AgentMessage,
  AgentEvent,
  AgentProgressEventPayload,
  AgentRunCompletedEventPayload,
  AgentRunFailedEventPayload,
  ClarificationAvailableEventPayload,
  WorkingCommittedEventPayload,
  AgentToolActivityEventPayload,
  CreateAgentRunRequest,
  CreateAgentRunResponse,
  Conversation,
  ListConversationsResponse,
  ListMessagesResponse,
  GetAgentRunRequest,
  GetAgentRunResponse,
  SubscribeAgentEventsRequest,
  CancelAgentRunRequest,
  CancelAgentRunResponse,
  AgentErrorPayload,
  AgentEvaluationCaseResult,
  AgentEvaluationReport,
} from './protocol/agent.ts';

export {
  ApiResultSchema,
  ProjectRecordSchema,
  PageRecordSchema,
  ProjectWithPagesSchema,
  CreateProjectSchema,
  OpenProjectSchema,
  RenameProjectSchema,
  DeleteDesktopRecordSchema,
  CreatePageSchema,
  ApplyPageSchema,
  SaveWorkingRevisionSchema,
  RestoreWorkingRevisionSchema,
  WorkingSchemaStateSchema,
  UpdateWorkingSchemaSchema,
  ApplyWorkingOperationsSchema,
  RevisionHistoryItemSchema,
  RevisionHistorySchema,
  PageApplyStateSchema,
  ApplyPageResultSchema,
  RenamePageSchema,
  DuplicatePageSchema,
  isApiResultEnvelope,
  isPageApplyState,
  isApplyPageResult,
} from './protocol/api.ts';

export type {
  ProjectWithPages,
  ApiResult,
  ProjectRecord,
  OpenProjectResult,
  PageRecord,
  PageApplyState,
  ApplyPageResult,
  RevisionHistoryItem,
  RevisionHistory,
} from './protocol/api.ts';

export {
  ProjectPageManifestSchema,
  ProjectManifestSchema,
  isProjectManifest,
} from './protocol/project-manifest.ts';

export type { ProjectPageManifest, ProjectManifest } from './protocol/project-manifest.ts';

export {
  ElementIdSchema,
  RevisionIdSchema,
  PageElementSchema,
  PageSchema,
  ChangeSourceSchema,
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
  SchemaOperationSchema,
  SchemaOperationBatchSchema,
  getElementLabel,
  getAgentElementLabel,
} from './protocol/schema.ts';

export {
  FlowIdSchema,
  PageFlowSchema,
  PageFlowNodeSchema,
  ElementEventBindingSchema,
} from './protocol/flow.ts';
export type { PageFlow, PageFlowNode, ElementEventBinding } from './protocol/flow.ts';

export type {
  OrigamixPageSchema,
  ChangeSource,
  SchemaOperation,
  SchemaOperationBatch,
} from './protocol/schema.ts';

export {
  validatePage,
  validateSchemaOperation,
  validateSchemaOperationBatch,
} from './protocol/validation.ts';

export type {
  ValidationResult,
  SemanticError,
  PageValidationResult,
} from './protocol/validation.ts';

export {
  FLOW_NODE_MANIFEST_VERSION,
  flowNodeManifests,
  flowNodeManifestCatalog,
  getFlowNodeManifest,
  isFlowNodeProps,
} from './protocol/flow-node.ts';

export type {
  FlowNodeManifest,
  FlowNodeType,
  FlowNodeProps,
  RuntimeFlowNodeType,
} from './protocol/flow-node.ts';

export { MATERIAL_MANIFEST_FORMAT_VERSION } from './protocol/material-manifest.ts';

export type {
  MaterialRole,
  JsonSchema,
  MaterialContextEntry,
  MaterialManifest,
  ValidationMaterialManifest,
  MaterialManifestCatalog,
  AgentMaterialSummary,
} from './protocol/material-manifest.ts';

export {
  VersionedStackReferenceSchema,
  ProjectStackSchema,
  BUILTIN_PROJECT_STACK,
  resolveProjectStack,
  validateResolvedProjectStack,
} from './protocol/project-stack.ts';

export type { ProjectStack } from './protocol/project-stack.ts';

export { HyperValueSchema, FunctionValueSchema, isHyperValue } from './protocol/hyper-value.ts';
export type { HyperValue, FunctionValue } from './protocol/hyper-value.ts';

export { ORIGAMIX_VERSION, ORIGAMIX_RELEASES, isSupportedOrigamixVersion } from './version.ts';

export {
  ProjectUpgradeRequestSchema,
  CancelProjectUpgradeRequestSchema,
} from './protocol/project-upgrade.ts';
export type {
  ProjectUpgradeRequest,
  ProjectUpgradeState,
  ProjectUpgradeResult,
} from './protocol/project-upgrade.ts';
