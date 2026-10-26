import Ajv from 'ajv';
import type { ErrorObject, ValidateFunction } from 'ajv';
import { AgentRunSchema, RunBudgetSchema, ToolPolicySchema } from './agent-run.ts';
import { MessageContentSchema, AgentMessageSchema } from './agent-message.ts';
import {
  AgentEventSchema,
  AgentProgressEventPayloadSchema,
  AgentRunCompletedEventPayloadSchema,
  AgentRunFailedEventPayloadSchema,
  WorkingCommittedEventPayloadSchema,
  AgentToolActivityEventPayloadSchema,
  ClarificationAvailableEventPayloadSchema,
} from './agent-event.ts';
import {
  RuntimeDiagnosticSchema,
  RuntimeRenderReportSchema,
  RuntimeReportResultSchema,
  PageRuntimeStateSchema,
} from './runtime-report.ts';
import {
  CreateAgentRunRequestSchema,
  CreateAgentRunResponseSchema,
  GetAgentRunRequestSchema,
  GetAgentRunResponseSchema,
  SubscribeAgentEventsRequestSchema,
  CancelAgentRunRequestSchema,
  CancelAgentRunResponseSchema,
  AgentErrorPayloadSchema,
  ListConversationsResponseSchema,
  ListMessagesResponseSchema,
} from './agent-api.ts';
import { AgentEvaluationReportSchema } from './agent-evaluation.ts';
import {
  CompletePageRunInputSchema,
  PageAgentOutcomeSchema,
  ClarificationResultSchema,
  OperationValidationFailureSchema,
} from './agent-outcome.ts';
import addFormats from 'ajv-formats';

export interface AgentProtocolValidationResult {
  valid: boolean;
  errors: ErrorObject[];
}

const schemas = {
  run: AgentRunSchema,
  budget: RunBudgetSchema,
  toolPolicy: ToolPolicySchema,
  messageContent: MessageContentSchema,
  message: AgentMessageSchema,
  event: AgentEventSchema,
  diagnostic: RuntimeDiagnosticSchema,
  runtimeReport: RuntimeRenderReportSchema,
  runtimeReportResult: RuntimeReportResultSchema,
  pageRuntimeState: PageRuntimeStateSchema,
  createRequest: CreateAgentRunRequestSchema,
  createResponse: CreateAgentRunResponseSchema,
  getRequest: GetAgentRunRequestSchema,
  getResponse: GetAgentRunResponseSchema,
  subscribeRequest: SubscribeAgentEventsRequestSchema,
  cancelRequest: CancelAgentRunRequestSchema,
  cancelResponse: CancelAgentRunResponseSchema,
  errorPayload: AgentErrorPayloadSchema,
  conversationsResponse: ListConversationsResponseSchema,
  messagesResponse: ListMessagesResponseSchema,
  evaluationReport: AgentEvaluationReportSchema,
  completePageRunInput: CompletePageRunInputSchema,
  pageAgentOutcome: PageAgentOutcomeSchema,
  clarificationResult: ClarificationResultSchema,
  operationValidationFailure: OperationValidationFailureSchema,
  progressEventPayload: AgentProgressEventPayloadSchema,
  completedEventPayload: AgentRunCompletedEventPayloadSchema,
  failedEventPayload: AgentRunFailedEventPayloadSchema,
  clarificationEventPayload: ClarificationAvailableEventPayloadSchema,
  workingCommittedEventPayload: WorkingCommittedEventPayloadSchema,
  toolActivityEventPayload: AgentToolActivityEventPayloadSchema,
};

let ajv: Ajv | undefined;

const validators: Partial<Record<keyof typeof schemas, ValidateFunction>> = {};

const getValidator = (name: keyof typeof schemas): ValidateFunction => {
  if (!ajv) {
    ajv = new Ajv({ allErrors: true, strict: true });
    addFormats(ajv);
  }
  return (validators[name] ??= ajv.compile(schemas[name]));
};

const result = (errors: ErrorObject[] | null | undefined): AgentProtocolValidationResult => {
  return { valid: !errors, errors: errors ? [...errors] : [] };
};

const check = (validator: ValidateFunction, value: unknown): AgentProtocolValidationResult => {
  validator(value);
  return result(validator.errors);
};

export const validateAgentRun = (value: unknown) => check(getValidator('run'), value);

export const validateRunBudget = (value: unknown) => check(getValidator('budget'), value);

export const validateToolPolicy = (value: unknown) => check(getValidator('toolPolicy'), value);

export const validateMessageContent = (value: unknown) =>
  check(getValidator('messageContent'), value);

export const validateAgentMessage = (value: unknown) => check(getValidator('message'), value);

export const validateAgentEvent = (value: unknown): AgentProtocolValidationResult => {
  const envelope = check(getValidator('event'), value);
  if (!envelope.valid || !value || typeof value !== 'object') return envelope;
  const event = value as { type?: unknown; payload?: unknown };
  if (event.type === 'run.queued') {
    return event.payload &&
      typeof event.payload === 'object' &&
      (event.payload as { status?: unknown }).status === 'queued'
      ? { valid: true, errors: [] }
      : { valid: false, errors: [] };
  }
  if (event.type === 'run.progress')
    return check(getValidator('progressEventPayload'), event.payload);
  if (event.type === 'run.completed')
    return check(getValidator('completedEventPayload'), event.payload);
  if (event.type === 'run.failed') return check(getValidator('failedEventPayload'), event.payload);
  if (event.type === 'clarification.available')
    return check(getValidator('clarificationEventPayload'), event.payload);
  if (event.type === 'working.committed')
    return check(getValidator('workingCommittedEventPayload'), event.payload);
  if (event.type === 'tool.activity')
    return check(getValidator('toolActivityEventPayload'), event.payload);
  if (event.type === 'run.cancelled' || event.type === 'run.interrupted') {
    return event.payload &&
      typeof event.payload === 'object' &&
      (event.payload as { status?: unknown }).status === event.type.slice(4)
      ? { valid: true, errors: [] }
      : { valid: false, errors: [] };
  }
  return { valid: false, errors: [] };
};

export const validateRuntimeDiagnostic = (value: unknown) =>
  check(getValidator('diagnostic'), value);

export const validateRuntimeRenderReport = (value: unknown) =>
  check(getValidator('runtimeReport'), value);

export const validateRuntimeReportResult = (value: unknown) =>
  check(getValidator('runtimeReportResult'), value);

export const validatePageRuntimeState = (value: unknown) =>
  check(getValidator('pageRuntimeState'), value);

export const validateCreateAgentRunRequest = (value: unknown) =>
  check(getValidator('createRequest'), value);

export const validateCreateAgentRunResponse = (value: unknown) =>
  check(getValidator('createResponse'), value);

export const validateGetAgentRunRequest = (value: unknown) =>
  check(getValidator('getRequest'), value);

export const validateGetAgentRunResponse = (value: unknown) =>
  check(getValidator('getResponse'), value);

export const validateSubscribeAgentEventsRequest = (value: unknown) =>
  check(getValidator('subscribeRequest'), value);

export const validateCancelAgentRunRequest = (value: unknown) =>
  check(getValidator('cancelRequest'), value);

export const validateCancelAgentRunResponse = (value: unknown) =>
  check(getValidator('cancelResponse'), value);

export const validateAgentErrorPayload = (value: unknown) =>
  check(getValidator('errorPayload'), value);

export const validateListConversationsResponse = (value: unknown) =>
  check(getValidator('conversationsResponse'), value);

export const validateListMessagesResponse = (value: unknown) =>
  check(getValidator('messagesResponse'), value);

export const validateAgentEvaluationReport = (value: unknown) =>
  check(getValidator('evaluationReport'), value);

export const validateCompletePageRunInput = (value: unknown) =>
  check(getValidator('completePageRunInput'), value);

export const validatePageAgentOutcome = (value: unknown) =>
  check(getValidator('pageAgentOutcome'), value);

export const validateClarificationResult = (value: unknown) =>
  check(getValidator('clarificationResult'), value);

export const validateOperationValidationFailure = (value: unknown) =>
  check(getValidator('operationValidationFailure'), value);
