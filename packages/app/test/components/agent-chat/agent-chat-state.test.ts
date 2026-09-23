import { describe, expect, it } from 'vitest';
import type { AgentEvent, AgentRun } from '@origamix/shared/protocol/agent';
import {
  agentChatReducer,
  initialAgentChatState,
} from '../../../src/components/agent-chat/agent-chat-state';

const run = (status: AgentRun['status'] = 'queued'): AgentRun => ({
  version: '1',
  runId: 'run_one',
  projectId: 'project_one',
  pageId: 'page_one',
  conversationId: 'conversation_one',
  userMessageId: 'message_one',
  requestId: 'request-one',
  baseWorkingVersion: 1,
  runKind: 'page_assistant',
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
  it('clears the previous Working success signal as soon as a new submission starts', () => {
    const previous = {
      ...initialAgentChatState,
      workingRefreshKey: 'working_run_previous_2',
      progressMessage: '正在保存页面草稿',
    };
    const state = agentChatReducer(previous, { type: 'submission.started' });
    expect(state.run).toBeNull();
    expect(state.stage).toBe('queued');
    expect(state.workingRefreshKey).toBeNull();
    expect(state.progressMessage).toBe('正在提交请求');
    expect(state.progressHistory).toEqual(['正在提交请求']);
  });

  it('refreshes Working after one Run and resets replay state for the next Run', () => {
    let state = agentChatReducer(initialAgentChatState, { type: 'run.queued', run: run() });
    state = agentChatReducer(state, {
      type: 'event.received',
      event: event(3, 'run.completed', { status: 'completed', resultWorkingVersion: 2 }),
    });
    expect(state.workingRefreshKey).toBe('working_run_one_2');

    state = agentChatReducer(state, { type: 'run.queued', run: run() });
    expect(state.lastEventId).toBe(-1);
    expect(state.workingRefreshKey).toBeNull();
  });

  it('uses typed commit events and ignores non-writing or stale Run events', () => {
    let state = agentChatReducer(initialAgentChatState, { type: 'run.queued', run: run() });
    state = agentChatReducer(state, {
      type: 'event.received',
      event: event(1, 'run.progress', {
        status: 'reasoning',
        phase: 'reasoning',
        message: '正在处理请求',
      }),
    });
    expect(state.progressMessage).toBe('正在处理请求');
    expect(state.progressHistory).toEqual(['请求已进入处理队列', '正在处理请求']);
    state = agentChatReducer(state, {
      type: 'event.received',
      event: event(2, 'run.completed', {
        status: 'completed',
        outcome: 'answered_only',
        response: '页面已重置。',
      }),
    });
    expect(state.workingRefreshKey).toBeNull();
    expect(state.progressMessage).toBeNull();
    expect(state.progressHistory.at(-1)).toBe('处理完成');
    expect(state.streamedText).toBe('页面已重置。');

    const stale = {
      ...event(3, 'working.committed', { resultWorkingVersion: 9 }),
      runId: 'run_old',
    };
    expect(
      agentChatReducer(state, { type: 'event.received', event: stale }).workingRefreshKey,
    ).toBeNull();
  });
});
