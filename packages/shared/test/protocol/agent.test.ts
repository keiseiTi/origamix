import { describe, expect, it } from 'vitest';
import {
  validateAgentEvent,
  validateAgentMessage,
  validateAgentRun,
  validateCancelAgentRunRequest,
  validateCreateAgentRunRequest,
  validatePageIntent,
  validateRuntimeDiagnostic,
  validateRuntimeRenderReport,
  validateRuntimeReportResult,
  validatePageRuntimeState,
  validateAgentErrorPayload,
  validateGetAgentRunRequest,
  validateSubscribeAgentEventsRequest,
} from '../../src/protocol/agent-validation';

const timestamp = '2026-09-04T00:00:00.000Z';
const content = { version: '1', blocks: [{ type: 'text', text: '创建客户表单' }] };

describe('agent domain protocol', () => {
  it('validates page modifications and rejects invalid confidence or missing page IDs', () => {
    const intent = {
      scope: 'page',
      mode: 'page_modify',
      pageId: 'page_customer',
      normalizedRequirement: '创建客户表单',
      confidence: 0.98,
      requiresConfirmation: false,
    };
    expect(validatePageIntent(intent).valid).toBe(true);
    expect(validatePageIntent({ ...intent, confidence: 2 }).valid).toBe(false);
    expect(validatePageIntent({ ...intent, pageId: '' }).valid).toBe(false);
    expect(validatePageIntent({ ...intent, extra: true }).valid).toBe(false);
  });

  it('represents questions, clarification and out-of-scope results without write ambiguity', () => {
    expect(
      validatePageIntent({
        scope: 'page',
        mode: 'page_question',
        pageId: 'page_customer',
        normalizedRequirement: '说明表格有哪些列',
        confidence: 0.96,
        requiresConfirmation: false,
      }).valid,
    ).toBe(true);
    expect(
      validatePageIntent({
        scope: 'page',
        mode: 'clarification_required',
        pageId: 'page_customer',
        confidence: 0.55,
        reason: '请求可能是页面需求，也可能是现实信息查询',
        suggestedQuestion: '你希望创建一个天气展示页面吗？',
        requiresConfirmation: true,
      }).valid,
    ).toBe(true);
    expect(
      validatePageIntent({
        scope: 'page',
        mode: 'out_of_scope',
        confidence: 0.99,
        reason: '请求是现实天气查询',
        requiresConfirmation: false,
      }).valid,
    ).toBe(true);
    expect(
      validatePageIntent({
        scope: 'page',
        mode: 'out_of_scope',
        pageId: 'page_customer',
        normalizedRequirement: '修改页面',
        confidence: 0.99,
        reason: '不应携带页面写入需求',
        requiresConfirmation: false,
      }).valid,
    ).toBe(false);
  });

  it('validates run associations, budgets and terminal states', () => {
    const run = {
      version: '1',
      runId: 'run_one',
      projectId: 'project_one',
      pageId: 'page_one',
      conversationId: 'conversation_one',
      userMessageId: 'message_one',
      requestId: 'request-one',
      baseWorkingVersion: 1,
      mode: 'page_modify',
      status: 'completed',
      budget: {
        maxModelCalls: 2,
        maxToolCalls: 8,
        maxOutputTokens: 4000,
        maxDurationMs: 60000,
        maxSchemaBytes: 100000,
        maxRepairAttempts: 1,
      },
      modelRef: 'deepseek/model',
      promptVersion: '1',
      policyVersion: '1',
      toolsetVersion: '1',
      materialManifestVersion: '1',
      resultWorkingVersion: 2,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    expect(validateAgentRun(run).valid).toBe(true);
    expect(validateAgentRun({ ...run, status: 'done' }).valid).toBe(false);
    for (const status of [
      'classifying',
      'generating',
      'tool_calling',
      'validating',
      'committing',
      'awaiting_confirmation',
    ]) {
      expect(validateAgentRun({ ...run, status }).valid).toBe(true);
    }
    expect(validateAgentRun({ ...run, userMessageId: undefined }).valid).toBe(false);
    expect(validateAgentRun({ ...run, budget: { ...run.budget, maxToolCalls: 0 } }).valid).toBe(
      false,
    );
    expect(
      validateAgentRun({ ...run, budget: { ...run.budget, maxRepairAttempts: -1 } }).valid,
    ).toBe(false);
  });

  it('validates versioned message block unions', () => {
    const message = {
      version: '1',
      messageId: 'message_one',
      conversationId: 'conversation_one',
      role: 'user',
      content,
      sequence: 0,
      createdAt: timestamp,
    };
    expect(validateAgentMessage(message).valid).toBe(true);
    expect(
      validateAgentMessage({ ...message, content: { version: '2', blocks: content.blocks } }).valid,
    ).toBe(false);
    expect(
      validateAgentMessage({
        ...message,
        content: { version: '1', blocks: [{ type: 'video', id: 'x' }] },
      }).valid,
    ).toBe(false);
  });

  it('keeps event envelopes forward-compatible while validating their metadata', () => {
    const event = {
      version: '1',
      eventId: 4,
      sequence: 2,
      type: 'future.event',
      runId: 'run_one',
      pageId: 'page_one',
      requestId: 'request-one',
      occurredAt: timestamp,
      payload: { future: true },
    };
    expect(validateAgentEvent(event).valid).toBe(true);
    expect(validateAgentEvent({ ...event, version: '2' }).valid).toBe(false);
    expect(validateAgentEvent({ ...event, sequence: -1 }).valid).toBe(false);
  });

  it('validates diagnostics and run HTTP payloads', () => {
    expect(
      validateRuntimeDiagnostic({
        code: 'MATERIAL_RENDER_FAILED',
        severity: 'error',
        stage: 'render',
        pageId: 'page_one',
        revisionId: 'revision_one',
        elementId: 'table-one',
        materialType: 'table',
        safeMessage: '表格无法渲染',
      }).valid,
    ).toBe(true);
    expect(
      validateCreateAgentRunRequest({
        version: '1',
        projectId: 'project_one',
        pageId: 'page_one',
        conversationId: 'conversation_one',
        clientRequestId: 'request-one',
        baseWorkingVersion: 1,
        content,
      }).valid,
    ).toBe(true);
    expect(validateCancelAgentRunRequest({ version: '1' }).valid).toBe(false);
    expect(validateGetAgentRunRequest({ version: '1', runId: 'run_one' }).valid).toBe(true);
    expect(
      validateSubscribeAgentEventsRequest({ version: '1', runId: 'run_one', afterEventId: 4 })
        .valid,
    ).toBe(true);
    expect(
      validateSubscribeAgentEventsRequest({ version: '1', runId: 'run_one', afterEventId: -1 })
        .valid,
    ).toBe(false);
    expect(
      validateAgentErrorPayload({
        code: 'REVISION_CONFLICT',
        safeMessage: '页面已变化',
        retryable: true,
      }).valid,
    ).toBe(true);
    expect(
      validateAgentErrorPayload({ code: 'UNKNOWN', safeMessage: 'x', retryable: false }).valid,
    ).toBe(false);

    const runtimeReport = {
      version: '1',
      projectId: 'project_one',
      pageId: 'page_one',
      revisionId: 'revision_one',
      outcome: 'failed',
      diagnostics: [
        {
          code: 'MATERIAL_RENDER_FAILED',
          severity: 'error',
          stage: 'render',
          pageId: 'page_one',
          revisionId: 'revision_one',
          safeMessage: '表格无法渲染',
        },
      ],
      observedAt: timestamp,
    };
    expect(validateRuntimeRenderReport(runtimeReport).valid).toBe(true);
    expect(validateRuntimeRenderReport({ ...runtimeReport, outcome: 'unknown' }).valid).toBe(false);
    expect(
      validateRuntimeReportResult({
        version: '1',
        disposition: 'stale',
        currentRevisionId: 'revision_two',
      }).valid,
    ).toBe(true);
    expect(
      validatePageRuntimeState({
        version: '1',
        projectId: 'project_one',
        pageId: 'page_one',
        currentRevisionId: 'revision_two',
        lastKnownGoodRevisionId: 'revision_one',
        visualRevisionId: 'revision_one',
        diagnostics: [],
      }).valid,
    ).toBe(true);
  });
});
