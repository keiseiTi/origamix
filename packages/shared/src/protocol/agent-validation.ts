import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import {
  AgentEventSchema,
  AgentMessageSchema,
  AgentRunSchema,
  MessageContentSchema,
  RunBudgetSchema,
  CancelAgentRunRequestSchema,
  CancelAgentRunResponseSchema,
  CreateAgentRunRequestSchema,
  CreateAgentRunResponseSchema,
  GetAgentRunRequestSchema,
  GetAgentRunResponseSchema,
  PageIntentSchema,
  RuntimeDiagnosticSchema,
  RuntimeRenderReportSchema,
  RuntimeReportResultSchema,
  PageRuntimeStateSchema,
  SubscribeAgentEventsRequestSchema,
  ToolPolicySchema,
  AgentErrorPayloadSchema,
  ListConversationsResponseSchema,
  ListMessagesResponseSchema,
  AgentEvaluationReportSchema,
} from './agent';

export interface AgentProtocolValidationResult {
  valid: boolean;
  errors: ErrorObject[];
}

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const validators = {
  intent: ajv.compile(PageIntentSchema),
  run: ajv.compile(AgentRunSchema),
  budget: ajv.compile(RunBudgetSchema),
  toolPolicy: ajv.compile(ToolPolicySchema),
  messageContent: ajv.compile(MessageContentSchema),
  message: ajv.compile(AgentMessageSchema),
  event: ajv.compile(AgentEventSchema),
  diagnostic: ajv.compile(RuntimeDiagnosticSchema),
  runtimeReport: ajv.compile(RuntimeRenderReportSchema),
  runtimeReportResult: ajv.compile(RuntimeReportResultSchema),
  pageRuntimeState: ajv.compile(PageRuntimeStateSchema),
  createRequest: ajv.compile(CreateAgentRunRequestSchema),
  createResponse: ajv.compile(CreateAgentRunResponseSchema),
  getRequest: ajv.compile(GetAgentRunRequestSchema),
  getResponse: ajv.compile(GetAgentRunResponseSchema),
  subscribeRequest: ajv.compile(SubscribeAgentEventsRequestSchema),
  cancelRequest: ajv.compile(CancelAgentRunRequestSchema),
  cancelResponse: ajv.compile(CancelAgentRunResponseSchema),
  errorPayload: ajv.compile(AgentErrorPayloadSchema),
  conversationsResponse: ajv.compile(ListConversationsResponseSchema),
  messagesResponse: ajv.compile(ListMessagesResponseSchema),
  evaluationReport: ajv.compile(AgentEvaluationReportSchema),
};

function result(errors: ErrorObject[] | null | undefined): AgentProtocolValidationResult {
  return { valid: !errors, errors: errors ? [...errors] : [] };
}

function check(
  validator: (value: unknown) => boolean,
  value: unknown,
): AgentProtocolValidationResult {
  validator(value);
  return result((validator as typeof validators.run).errors);
}

export const validatePageIntent = (value: unknown) => check(validators.intent, value);
export const validateAgentRun = (value: unknown) => check(validators.run, value);
export const validateRunBudget = (value: unknown) => check(validators.budget, value);
export const validateToolPolicy = (value: unknown) => check(validators.toolPolicy, value);
export const validateMessageContent = (value: unknown) => check(validators.messageContent, value);
export const validateAgentMessage = (value: unknown) => check(validators.message, value);
export const validateAgentEvent = (value: unknown) => check(validators.event, value);
export const validateRuntimeDiagnostic = (value: unknown) => check(validators.diagnostic, value);
export const validateRuntimeRenderReport = (value: unknown) =>
  check(validators.runtimeReport, value);
export const validateRuntimeReportResult = (value: unknown) =>
  check(validators.runtimeReportResult, value);
export const validatePageRuntimeState = (value: unknown) =>
  check(validators.pageRuntimeState, value);
export const validateCreateAgentRunRequest = (value: unknown) =>
  check(validators.createRequest, value);
export const validateCreateAgentRunResponse = (value: unknown) =>
  check(validators.createResponse, value);
export const validateGetAgentRunRequest = (value: unknown) => check(validators.getRequest, value);
export const validateGetAgentRunResponse = (value: unknown) => check(validators.getResponse, value);
export const validateSubscribeAgentEventsRequest = (value: unknown) =>
  check(validators.subscribeRequest, value);
export const validateCancelAgentRunRequest = (value: unknown) =>
  check(validators.cancelRequest, value);
export const validateCancelAgentRunResponse = (value: unknown) =>
  check(validators.cancelResponse, value);
export const validateAgentErrorPayload = (value: unknown) => check(validators.errorPayload, value);
export const validateListConversationsResponse = (value: unknown) =>
  check(validators.conversationsResponse, value);
export const validateListMessagesResponse = (value: unknown) =>
  check(validators.messagesResponse, value);
export const validateAgentEvaluationReport = (value: unknown) =>
  check(validators.evaluationReport, value);
