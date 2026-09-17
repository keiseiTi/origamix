// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateAgentRunRequest } from '@origamix/shared/protocol/agent';
import { pageOperationKey, usePendingOperations } from '../../src/store/pending-operations';

const input: CreateAgentRunRequest = {
  version: '1',
  projectId: 'project_a',
  pageId: 'page_a',
  clientRequestId: 'request_agent',
  baseRevisionId: 'revision_a',
  content: { version: '1', blocks: [{ type: 'text', text: 'draft' }] },
};

describe('pending operation lifetime', () => {
  beforeEach(() => usePendingOperations.setState({ applies: {}, agents: {} }));
  afterEach(() => vi.restoreAllMocks());

  it('retains uncertain requests in memory without persisting their content', () => {
    const sessionWrite = vi.spyOn(sessionStorage, 'setItem');
    const localWrite = vi.spyOn(localStorage, 'setItem');
    const key = pageOperationKey(input.projectId, input.pageId);
    const operations = usePendingOperations.getState();
    operations.setApply(key, {
      revisionId: 'revision_a',
      clientRequestId: 'request_apply',
      inFlight: true,
    });
    operations.setAgent(key, { input, inFlight: true });
    operations.finishApply(key, 'request_apply', false);
    operations.finishAgent(key, input.clientRequestId, false);
    expect(usePendingOperations.getState().applies[key]).toEqual({
      revisionId: 'revision_a',
      clientRequestId: 'request_apply',
      inFlight: false,
    });
    expect(usePendingOperations.getState().agents[key]).toEqual({ input, inFlight: false });
    expect(sessionWrite).not.toHaveBeenCalled();
    expect(localWrite).not.toHaveBeenCalled();
  });

  it('does not clear newer requests when an older response arrives', () => {
    const key = pageOperationKey(input.projectId, input.pageId);
    const operations = usePendingOperations.getState();
    const latestApply = {
      revisionId: 'revision_b',
      clientRequestId: 'request_new',
      inFlight: true,
    };
    const latestAgent = { input: { ...input, clientRequestId: 'agent_new' }, inFlight: true };
    operations.setApply(key, latestApply);
    operations.setAgent(key, latestAgent);
    operations.finishApply(key, 'request_old', true);
    operations.finishAgent(key, 'agent_old', false);
    expect(usePendingOperations.getState().applies[key]).toEqual(latestApply);
    expect(usePendingOperations.getState().agents[key]).toEqual(latestAgent);
  });

  it('settles one project without clearing another project with the same page ID', () => {
    const first = pageOperationKey('project_a', 'page_a');
    const second = pageOperationKey('project_b', 'page_a');
    const operations = usePendingOperations.getState();
    for (const key of [first, second]) {
      operations.setApply(key, {
        revisionId: 'revision_a',
        clientRequestId: 'request_apply',
        inFlight: true,
      });
      operations.setAgent(key, { input, inFlight: true });
    }
    operations.finishApply(first, 'request_apply', true);
    operations.finishAgent(first, input.clientRequestId, true);
    expect(Object.keys(usePendingOperations.getState().applies)).toEqual([second]);
    expect(Object.keys(usePendingOperations.getState().agents)).toEqual([second]);
  });
});
