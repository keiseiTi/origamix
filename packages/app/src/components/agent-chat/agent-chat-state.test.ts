import { describe, expect, it } from 'vitest';
import type { AgentEvent, AgentRun } from '@origamix/shared/protocol/agent';
import { agentChatReducer, initialAgentChatState, isRunActive } from './agent-chat-state';

const run = (status: AgentRun['status'] = 'queued'): AgentRun => ({
  version: '1',
  runId: 'run_one',
  projectId: 'project_one',
  pageId: 'page_one',
  conversationId: 'conversation_one',
  userMessageId: 'message_one',
  requestId: 'request-one',
  baseRevisionId: 'revision_one',
  mode: 'page_modify',
  status,
  budget: {
    maxModelCalls: 2,
    maxToolCalls: 3,
    maxOutputTokens: 1000,
    maxDurationMs: 10_000,
    maxSchemaBytes: 1000,
    maxRepairAttempts: 1,
  },
  modelRef: 'fake',
  promptVersion: '1',
  policyVersion: '1',
  toolsetVersion: '1',
  materialManifestVersion: '1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});
const event = (eventId: number, type: string, payload: unknown = {}): AgentEvent => ({
  version: '1',
  eventId,
  sequence: eventId,
  type,
  runId: 'run_one',
  pageId: 'page_one',
  requestId: 'request-one',
  occurredAt: '2026-01-01T00:00:00.000Z',
  payload,
});

describe('agent chat reducer', () => {
  it('concatenates assistant deltas once when replay contains duplicates', () => {
    const first = agentChatReducer(initialAgentChatState, {
      type: 'event.received',
      event: event(1, 'assistant.delta', { delta: '你好' }),
    });
    const duplicate = agentChatReducer(first, {
      type: 'event.received',
      event: event(1, 'assistant.delta', { delta: '重复' }),
    });
    const second = agentChatReducer(duplicate, {
      type: 'event.received',
      event: event(2, 'assistant.delta', { delta: '，页面已更新' }),
    });
    expect(second.streamedText).toBe('你好，页面已更新');
    expect(second.lastEventId).toBe(2);
  });

  it('tracks stages, tools, committed revision and terminal state independently', () => {
    let state = agentChatReducer(initialAgentChatState, { type: 'run.queued', run: run() });
    state = agentChatReducer(state, {
      type: 'event.received',
      event: event(1, 'run.status_changed', { status: 'validating' }),
    });
    state = agentChatReducer(state, {
      type: 'event.received',
      event: event(2, 'tool.started', { toolCallId: 'tool_1', toolName: 'replace_page_schema' }),
    });
    state = agentChatReducer(state, {
      type: 'event.received',
      event: { ...event(3, 'schema.committed'), revisionId: 'revision_two' },
    });
    state = agentChatReducer(state, { type: 'event.received', event: event(4, 'run.cancelled') });
    expect(state.stage).toBe('cancelled');
    expect(state.tools).toEqual([{ id: 'tool_1', name: 'replace_page_schema', status: 'running' }]);
    expect(state.committedRevisionId).toBe('revision_two');
    expect(isRunActive(state.stage)).toBe(false);
  });

  it('restores an interrupted run with actionable retry feedback', () => {
    const state = agentChatReducer(initialAgentChatState, {
      type: 'history.loaded',
      messages: [],
      run: run('interrupted'),
    });
    expect(state.error).toContain('重新描述并发送');
  });

  it('resets per-run replay and commit state when a new run is queued', () => {
    const previous = {
      ...initialAgentChatState,
      lastEventId: 9,
      committedRevisionId: 'revision_old',
    };
    const state = agentChatReducer(previous, { type: 'run.queued', run: run() });
    expect(state.lastEventId).toBe(-1);
    expect(state.committedRevisionId).toBeNull();
  });
});
