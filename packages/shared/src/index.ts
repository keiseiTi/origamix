export {
  CreateAgentRunRequestSchema,
  CreateAgentRunResponseSchema,
  ListConversationsResponseSchema,
  ListMessagesResponseSchema,
  GetAgentRunResponseSchema,
  GetAgentRunRequestSchema,
  SubscribeAgentEventsRequestSchema,
  CancelAgentRunRequestSchema,
  CancelAgentRunResponseSchema,
  AgentErrorPayloadSchema,
} from './agent/agent-api.ts';
export type {
  CreateAgentRunRequest,
  CreateAgentRunResponse,
  ListConversationsResponse,
  ListMessagesResponse,
  GetAgentRunRequest,
  GetAgentRunResponse,
  SubscribeAgentEventsRequest,
  CancelAgentRunRequest,
  CancelAgentRunResponse,
  AgentErrorPayload,
} from './agent/agent-api.ts';

export {
  AgentEvaluationCaseResultSchema,
  AgentEvaluationReportSchema,
} from './agent/agent-evaluation.ts';
export type { AgentEvaluationCaseResult, AgentEvaluationReport } from './agent/agent-evaluation.ts';

export {
  AgentEventSchema,
  AgentProgressEventPayloadSchema,
  AgentRunCompletedEventPayloadSchema,
  AgentRunFailedEventPayloadSchema,
  WorkingCommittedEventPayloadSchema,
  AgentToolActivityEventPayloadSchema,
  ClarificationAvailableEventPayloadSchema,
} from './agent/agent-event.ts';
export type {
  AgentEvent,
  AgentProgressEventPayload,
  AgentRunCompletedEventPayload,
  AgentRunFailedEventPayload,
  WorkingCommittedEventPayload,
  AgentToolActivityEventPayload,
  ClarificationAvailableEventPayload,
} from './agent/agent-event.ts';

export {
  MessageContentBlockSchema,
  MessageContentSchema,
  AgentMessageSchema,
  ConversationSchema,
} from './agent/agent-message.ts';
export type {
  MessageContentBlock,
  MessageContent,
  AgentMessage,
  Conversation,
} from './agent/agent-message.ts';

export {
  ClarificationCandidateSchema,
  CompletePageRunInputSchema,
  CompletePageRunToolParametersSchema,
  PageAgentOutcomeSchema,
  ClarificationResultSchema,
  ClarificationSelectionSchema,
  OperationValidationFailureSchema,
} from './agent/agent-outcome.ts';
export type {
  ClarificationCandidate,
  CompletePageRunInput,
  PageAgentOutcome,
  ClarificationResult,
  ClarificationSelection,
  OperationValidationFailure,
} from './agent/agent-outcome.ts';

export {
  AgentRunKindSchema,
  AgentRunStatusSchema,
  RunBudgetSchema,
  ToolPolicySchema,
  AgentRunSchema,
} from './agent/agent-run.ts';
export type {
  AgentRunKind,
  AgentRunStatus,
  RunBudget,
  ToolPolicy,
  AgentRun,
} from './agent/agent-run.ts';

export {
  AgentProtocolVersionSchema,
  AgentRunIdSchema,
  ConversationIdSchema,
  MessageIdSchema,
  PageIdSchema,
  RequestIdSchema,
  IsoDateTimeSchema,
} from './agent/agent-schema.ts';

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
} from './agent/agent-validation.ts';
export type { AgentProtocolValidationResult } from './agent/agent-validation.ts';

export {
  RuntimeDiagnosticSchema,
  RuntimeRenderReportSchema,
  RuntimeReportResultSchema,
  PageRuntimeStateSchema,
} from './agent/runtime-report.ts';
export type {
  RuntimeDiagnostic,
  RuntimeRenderReport,
  RuntimeReportResult,
  PageRuntimeState,
} from './agent/runtime-report.ts';

export {
  FLOW_NODE_MANIFEST_VERSION,
  flowNodeManifests,
  flowNodeManifestCatalog,
  getFlowNodeManifest,
  isFlowNodeProps,
} from './flow/flow-node-manifest.ts';
export type {
  FlowNodeManifest,
  FlowNodeType,
  FlowNodeProps,
  RuntimeFlowNodeType,
} from './flow/flow-node-manifest.ts';

export {
  FlowIdSchema,
  PageFlowSchema,
  PageFlowNodeSchema,
  ElementEventBindingSchema,
} from './flow/flow-schema.ts';
export type { PageFlow, PageFlowNode, ElementEventBinding } from './flow/flow-schema.ts';

export { HyperValueSchema, FunctionValueSchema, isHyperValue } from './flow/hyper-value.ts';
export type { HyperValue, FunctionValue } from './flow/hyper-value.ts';

export {
  MATERIAL_MANIFEST_FORMAT_VERSION,
  getMaterialDisplay,
} from './material/material-manifest.ts';
export type {
  MaterialRole,
  MaterialLayout,
  JsonSchema,
  MaterialContextEntry,
  MaterialManifest,
  ValidationMaterialManifest,
  MaterialManifestCatalog,
  AgentMaterialSummary,
} from './material/material-manifest.ts';

export {
  PageRecordSchema,
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
  isPageApplyState,
  isApplyPageResult,
} from './page/page-api.ts';
export type {
  PageRecord,
  PageApplyState,
  ApplyPageResult,
  RevisionHistoryItem,
  RevisionHistory,
} from './page/page-api.ts';

export {
  ElementIdSchema,
  RevisionIdSchema,
  PageElementSchema,
  PageSchema,
  getElementLabel,
  getAgentElementLabel,
  GlobalVariableSchema,
} from './page/page-schema.ts';
export type { OrigamixPageSchema, GlobalVariable } from './page/page-schema.ts';

export {
  validatePage,
  validateSchemaOperation,
  validateSchemaOperationBatch,
  isPageSchema,
} from './page/page-validation.ts';
export type {
  ValidationResult,
  SemanticError,
  PageValidationResult,
} from './page/page-validation.ts';

export {
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
} from './page/schema-operation.ts';
export type {
  ChangeSource,
  SchemaOperation,
  SchemaOperationBatch,
} from './page/schema-operation.ts';

export {
  ProjectRecordSchema,
  ProjectWithPagesSchema,
  CreateProjectSchema,
  OpenProjectSchema,
  RenameProjectSchema,
  DeleteDesktopRecordSchema,
} from './project/project-api.ts';
export type { ProjectWithPages, ProjectRecord, OpenProjectResult } from './project/project-api.ts';

export {
  ProjectPageManifestSchema,
  ProjectManifestSchema,
  isProjectManifest,
} from './project/project-manifest.ts';
export type { ProjectPageManifest, ProjectManifest } from './project/project-manifest.ts';

export {
  VersionedStackReferenceSchema,
  ProjectStackSchema,
  BUILTIN_PROJECT_STACK,
  resolveProjectStack,
  validateResolvedProjectStack,
} from './project/project-stack.ts';
export type { ProjectStack } from './project/project-stack.ts';

export {
  ProjectUpgradeRequestSchema,
  CancelProjectUpgradeRequestSchema,
} from './project/project-upgrade.ts';
export type {
  ProjectUpgradeRequest,
  ProjectUpgradeState,
  ProjectUpgradeResult,
} from './project/project-upgrade.ts';

export { ApiResultSchema, isApiResultEnvelope } from './transport/api-result.ts';
export type { ApiResult } from './transport/api-result.ts';

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
} from './transport/credential-gateway.ts';
export type {
  CredentialReference,
  CredentialPurpose,
  CredentialRequest,
  CredentialResponse,
} from './transport/credential-gateway.ts';

export type {
  BackendConnection,
  DirectoryGrant,
  UserProfile,
  ModelSettings,
  DesktopApi,
} from './transport/desktop-api.ts';

export {
  PreviewRenderDiagnosticSchema,
  PreviewRenderReportSchema,
} from './transport/preview-message.ts';
export type {
  PreviewSnapshot,
  PreviewRenderDiagnostic,
  PreviewRenderReport,
} from './transport/preview-message.ts';

export { ORIGAMIX_VERSION, ORIGAMIX_RELEASES, isSupportedOrigamixVersion } from './version.ts';
