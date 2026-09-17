// @vitest-environment happy-dom
import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pageOperationKey, usePendingOperations } from '../../../src/store/pending-operations';

const mocks = vi.hoisted(() => ({
  listConversations: vi.fn(),
  listAllMessages: vi.fn(),
  getAgentRun: vi.fn(),
  createAgentRun: vi.fn(),
  cancelAgentRun: vi.fn(),
  subscribeAgentEvents: vi.fn(),
  get: vi.fn(),
}));
vi.mock('../../../src/services/agent', () => mocks);
vi.mock('../../../src/services/schema', () => ({ schemaService: { get: mocks.get } }));
import { ApiRequestError } from '../../../src/services/request';
import { useAgentChat } from '../../../src/components/agent-chat/use-agent-chat';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('Agent recovery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    usePendingOperations.setState({ applies: {}, agents: {} });
    mocks.listConversations.mockResolvedValue({ conversations: [] });
    mocks.listAllMessages.mockResolvedValue({ messages: [] });
    mocks.get.mockResolvedValue({ revisionId: 'revision_1' });
    mocks.getAgentRun.mockResolvedValue({ run: { runId: 'run_1', status: 'completed' } });
    mocks.subscribeAgentEvents.mockReturnValue(() => undefined);
  });
  afterEach(cleanup);

  it('blocks submissions until recovery succeeds, including after a failed recovery', async () => {
    mocks.listConversations.mockRejectedValueOnce(new Error('offline'));
    const hook = renderHook(() => useAgentChat('project_1', 'page_a'));
    expect(hook.result.current.activity).toBe('unknown');
    await waitFor(() => expect(hook.result.current.state.error).toBe('offline'));
    await act(async () => {
      await expect(hook.result.current.send('hello')).rejects.toThrow();
    });
    expect(mocks.createAgentRun).not.toHaveBeenCalled();
    await act(async () => hook.result.current.retry());
    expect(hook.result.current.activity).toBe('idle');
  });

  it('retries the exact uncertain request after unmount without automatically resending', async () => {
    mocks.createAgentRun
      .mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce({ conversationId: 'conversation_1', runId: 'run_1' });
    const first = renderHook(() => useAgentChat('project_1', 'page_a'));
    await waitFor(() => expect(first.result.current.activity).toBe('idle'));
    await act(async () => {
      await expect(first.result.current.send('hello')).rejects.toThrow();
    });
    const original = mocks.createAgentRun.mock.calls[0]![0];
    first.unmount();
    // Recovery discovers a conversation created by the ambiguous request. Retry must
    // still omit conversationId exactly as the original request did.
    mocks.listConversations.mockResolvedValue({
      conversations: [{ conversationId: 'conversation_1' }],
    });
    mocks.get.mockResolvedValue({ revisionId: 'revision_2' });
    const next = renderHook(() => useAgentChat('project_1', 'page_a'));
    await waitFor(() => expect(mocks.listAllMessages).toHaveBeenCalled());
    expect(next.result.current.pendingSubmission).toBe(true);
    expect(next.result.current.activity).toBe('unknown');
    expect(mocks.createAgentRun).toHaveBeenCalledTimes(1);
    await act(async () => next.result.current.retry());
    expect(mocks.createAgentRun.mock.calls[1]![0]).toEqual(original);
    expect(usePendingOperations.getState().agents).toEqual({});
    expect(next.result.current.activity).toBe('idle');
  });

  it('isolates pending requests by project and blocks overlapping retries after remount', async () => {
    const response = deferred<{ conversationId: string; runId: string }>();
    mocks.createAgentRun.mockReturnValue(response.promise);
    const first = renderHook(() => useAgentChat('project_1', 'page_a'));
    await waitFor(() => expect(first.result.current.activity).toBe('idle'));
    let request!: Promise<void>;
    await act(async () => {
      request = first.result.current.send('hello');
    });
    first.unmount();
    const next = renderHook(() => useAgentChat('project_1', 'page_a'));
    const other = renderHook(() => useAgentChat('project_2', 'page_a'));
    await waitFor(() => expect(other.result.current.activity).toBe('idle'));
    expect(next.result.current.activity).toBe('unknown');
    await act(async () => {
      await expect(next.result.current.retry()).rejects.toThrow('处理中');
    });
    expect(mocks.createAgentRun).toHaveBeenCalledTimes(1);
    const recovery = deferred<{ conversations: { conversationId: string }[] }>();
    mocks.listConversations.mockReturnValueOnce(recovery.promise);
    await act(async () => {
      response.resolve({ conversationId: 'conversation_1', runId: 'run_1' });
      await request;
    });
    expect(next.result.current.activity).toBe('unknown');
    mocks.listAllMessages.mockResolvedValue({ messages: [{ runId: 'run_1', sequence: 0 }] });
    mocks.getAgentRun.mockResolvedValue({ run: { runId: 'run_1', status: 'generating' } });
    await act(async () =>
      recovery.resolve({ conversations: [{ conversationId: 'conversation_1' }] }),
    );
    expect(next.result.current.activity).toBe('running');
    expect(
      usePendingOperations.getState().agents[pageOperationKey('project_1', 'page_a')],
    ).toBeUndefined();
  });

  it('ignores history from the page that was left', async () => {
    const response = deferred<{ conversations: { conversationId: string }[] }>();
    mocks.listConversations.mockReturnValueOnce(response.promise);
    const hook = renderHook(({ pageId }) => useAgentChat('project_1', pageId), {
      initialProps: { pageId: 'page_a' },
    });
    await waitFor(() => expect(mocks.listConversations).toHaveBeenCalledTimes(1));
    hook.rerender({ pageId: 'page_b' });
    await waitFor(() => expect(hook.result.current.activity).toBe('idle'));
    await act(async () => response.resolve({ conversations: [{ conversationId: 'old' }] }));
    expect(mocks.listAllMessages).not.toHaveBeenCalled();
    expect(hook.result.current.activity).toBe('idle');
  });
  it.each([200, 408, 500])('keeps ambiguous responses retryable (HTTP %s)', async (status) => {
    mocks.createAgentRun.mockRejectedValue(new ApiRequestError('uncertain response', 500, status));
    const hook = renderHook(() => useAgentChat('project_1', 'page_a'));
    await waitFor(() => expect(hook.result.current.activity).toBe('idle'));
    await act(async () => {
      await expect(hook.result.current.send('hello')).rejects.toThrow('uncertain');
    });
    expect(hook.result.current.pendingSubmission).toBe(true);
    expect(hook.result.current.activity).toBe('unknown');
  });

  it('clears a definitively rejected submission and recovers before accepting new input', async () => {
    mocks.createAgentRun.mockRejectedValue(new ApiRequestError('invalid input', 400, 400));
    const hook = renderHook(() => useAgentChat('project_1', 'page_a'));
    await waitFor(() => expect(hook.result.current.activity).toBe('idle'));
    await act(async () => {
      await expect(hook.result.current.send('hello')).rejects.toThrow('invalid');
    });
    expect(usePendingOperations.getState().agents).toEqual({});
    expect(hook.result.current.activity).toBe('unknown');
    await act(async () => hook.result.current.retry());
    expect(hook.result.current.activity).toBe('idle');
    expect(mocks.createAgentRun).toHaveBeenCalledOnce();
  });
});
