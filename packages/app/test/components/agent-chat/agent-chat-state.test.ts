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
  it('refreshes Working after one Run and resets replay state for the next Run', () => {
    let state = agentChatReducer(initialAgentChatState, { type: 'run.queued', run: run() });
    state = agentChatReducer(state, {
      type: 'event.received',
      event: event(3, 'run.completed', { status: 'completed', workingVersion: 2 }),
    });
    expect(state.workingRefreshKey).toBe('working_run_one_2');

    state = agentChatReducer(state, { type: 'run.queued', run: run() });
    expect(state.lastEventId).toBe(-1);
    expect(state.workingRefreshKey).toBeNull();
  });
});
