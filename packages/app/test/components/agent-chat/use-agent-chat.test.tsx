// @vitest-environment happy-dom
import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePendingOperations } from '../../../src/store/pending-operations';

const mocks = vi.hoisted(() => ({
  listConversations: vi.fn(),
  listAllMessages: vi.fn(),
  getAgentRun: vi.fn(),
  createAgentRun: vi.fn(),
  cancelAgentRun: vi.fn(),
  subscribeAgentEvents: vi.fn(),
  workingState: vi.fn(),
}));
vi.mock('../../../src/services/agent', () => mocks);
vi.mock('../../../src/services/schema', () => ({
  schemaService: { workingState: mocks.workingState },
}));
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
    mocks.workingState.mockResolvedValue({ revisionId: 'revision_1', workingVersion: 1 });
    mocks.getAgentRun.mockResolvedValue({ run: { runId: 'run_1', status: 'completed' } });
    mocks.subscribeAgentEvents.mockReturnValue(() => undefined);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

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

  it('shows SSE progress before a fast Run final answer already present in history', async () => {
    let onEvent: ((event: unknown) => void) | undefined;
    mocks.subscribeAgentEvents.mockImplementation(
      (_projectId: string, _runId: string, listener: { onEvent: (event: unknown) => void }) => {
        onEvent = listener.onEvent;
        return () => undefined;
      },
    );
    const userMessage = {
      messageId: 'message_user',
      runId: 'run_fast',
      sequence: 1,
      role: 'user',
      content: { version: '1', blocks: [{ type: 'text', text: '添加表单' }] },
    };
    const assistantMessage = {
      messageId: 'message_assistant',
      runId: 'run_fast',
      sequence: 2,
      role: 'assistant',
      content: { version: '1', blocks: [{ type: 'text', text: '已添加表单。' }] },
    };
    mocks.listConversations
      .mockResolvedValueOnce({ conversations: [] })
      .mockResolvedValue({ conversations: [{ conversationId: 'conversation_1' }] });
    mocks.createAgentRun.mockResolvedValue({
      conversationId: 'conversation_1',
      runId: 'run_fast',
      status: 'queued',
      run: {
        runId: 'run_fast',
        pageId: 'page_a',
        status: 'queued',
      },
    });
    mocks.getAgentRun.mockResolvedValue({
      run: {
        runId: 'run_fast',
        pageId: 'page_a',
        status: 'completed',
        resultWorkingVersion: 2,
      },
    });
    mocks.listAllMessages
      .mockResolvedValueOnce({ messages: [userMessage, assistantMessage] })
      .mockResolvedValue({ messages: [userMessage, assistantMessage] });
    const hook = renderHook(() => useAgentChat('project_1', 'page_a'));
    await waitFor(() => expect(hook.result.current.activity).toBe('idle'));

    let submission: Promise<void> | undefined;
    act(() => {
      submission = hook.result.current.send('添加表单');
    });
    await waitFor(() => expect(onEvent).toBeDefined());
    await act(async () => submission);
    expect(hook.result.current.state.messages).toEqual([userMessage]);
    expect(hook.result.current.state.stage).toBe('queued');
    act(() => {
      onEvent!({
        version: '1',
        eventId: 1,
        sequence: 1,
        type: 'run.progress',
        runId: 'run_fast',
        pageId: 'page_a',
        requestId: 'request_1',
        occurredAt: '2026-09-24T00:00:00.000Z',
        payload: { status: 'reasoning', phase: 'reasoning', message: '正在思考并规划页面修改' },
      });
      onEvent!({
        version: '1',
        eventId: 2,
        sequence: 2,
        type: 'tool.activity',
        runId: 'run_fast',
        pageId: 'page_a',
        requestId: 'request_1',
        occurredAt: '2026-09-24T00:00:00.000Z',
        payload: { toolName: 'complete_page_run', phase: 'completed' },
      });
      onEvent!({
        version: '1',
        eventId: 3,
        sequence: 3,
        type: 'run.completed',
        runId: 'run_fast',
        pageId: 'page_a',
        requestId: 'request_1',
        occurredAt: '2026-09-24T00:00:00.000Z',
        payload: {
          status: 'completed',
          outcome: 'changed',
          response: '已添加表单。',
          resultWorkingVersion: 2,
        },
      });
    });
    expect(hook.result.current.state.progressHistory).toContain('正在思考并规划页面修改');
    expect(hook.result.current.state.progressHistory).toContain('生成并执行页面操作链 · 完成');
    expect(hook.result.current.state.tools).toEqual([
      { id: 'complete_page_run', name: 'complete_page_run', status: 'completed' },
    ]);
    expect(hook.result.current.state.workingRefreshKey).toBe('working_run_fast_2');
    expect(hook.result.current.state.stage).toBe('completed');
    await waitFor(
      () => expect(hook.result.current.state.messages).toEqual([userMessage, assistantMessage]),
      { timeout: 3_000 },
    );
    expect(hook.result.current.state.progressHistory).toContain('正在思考并规划页面修改');
    expect(hook.result.current.state.progressHistory).toContain('生成并执行页面操作链 · 完成');
  });

  it('keeps the terminal answer visible until the persisted message is available', async () => {
    const userMessage = {
      messageId: 'message_user',
      runId: 'run_1',
      sequence: 1,
      role: 'user',
      content: { version: '1', blocks: [{ type: 'text', text: '重置页面' }] },
    };
    const assistantMessage = {
      messageId: 'message_assistant',
      runId: 'run_1',
      sequence: 2,
      role: 'assistant',
      content: { version: '1', blocks: [{ type: 'text', text: '页面已重置。' }] },
    };
    mocks.listConversations.mockResolvedValue({
      conversations: [{ conversationId: 'conversation_1' }],
    });
    mocks.listAllMessages
      .mockResolvedValueOnce({ messages: [userMessage] })
      .mockResolvedValueOnce({ messages: [userMessage] })
      .mockResolvedValueOnce({ messages: [userMessage, assistantMessage] });
    mocks.getAgentRun
      .mockResolvedValueOnce({ run: { runId: 'run_1', pageId: 'page_a', status: 'reasoning' } })
      .mockResolvedValueOnce({ run: { runId: 'run_1', pageId: 'page_a', status: 'completed' } })
      .mockResolvedValueOnce({
        run: {
          runId: 'run_1',
          pageId: 'page_a',
          status: 'completed',
          resultWorkingVersion: 2,
        },
      });
    let onEvent: ((event: unknown) => void) | undefined;
    mocks.subscribeAgentEvents.mockImplementation(
      (_projectId: string, _runId: string, listener: { onEvent: (event: unknown) => void }) => {
        onEvent = listener.onEvent;
        return () => undefined;
      },
    );
    const hook = renderHook(() => useAgentChat('project_1', 'page_a'));
    await waitFor(() => expect(onEvent).toBeDefined());

    act(() =>
      onEvent!({
        version: '1',
        eventId: 1,
        sequence: 1,
        type: 'run.completed',
        runId: 'run_1',
        pageId: 'page_a',
        requestId: 'request_1',
        occurredAt: '2026-09-23T00:00:00.000Z',
        payload: {
          status: 'completed',
          outcome: 'changed',
          response: '页面已重置。',
          resultWorkingVersion: 2,
        },
      }),
    );

    expect(hook.result.current.state.streamedText).toBe('页面已重置。');

    await waitFor(() => expect(hook.result.current.state.stage).toBe('completed'));
    expect(hook.result.current.state.messages).toEqual([userMessage]);
    expect(hook.result.current.state.streamedText).toBe('页面已重置。');

    await act(async () => hook.result.current.refresh());
    expect(hook.result.current.state.messages).toEqual([userMessage, assistantMessage]);
    expect(hook.result.current.state.streamedText).toBe('');
  });

  it('settles a completed Run after SSE closes without starting another subscription', async () => {
    let onClose: (() => void) | undefined;
    mocks.subscribeAgentEvents.mockImplementation(
      (_projectId: string, _runId: string, listener: { onClose: () => void }) => {
        onClose = listener.onClose;
        return () => undefined;
      },
    );
    const userMessage = {
      messageId: 'message_user',
      runId: 'run_1',
      sequence: 1,
      role: 'user',
      content: { version: '1', blocks: [{ type: 'text', text: '重置页面' }] },
    };
    const assistantMessage = {
      messageId: 'message_assistant',
      runId: 'run_1',
      sequence: 2,
      role: 'assistant',
      content: { version: '1', blocks: [{ type: 'text', text: '页面已重置。' }] },
    };
    mocks.listConversations.mockResolvedValue({
      conversations: [{ conversationId: 'conversation_1' }],
    });
    mocks.listAllMessages
      .mockResolvedValueOnce({ messages: [userMessage] })
      .mockResolvedValue({ messages: [userMessage, assistantMessage] });
    mocks.getAgentRun
      .mockResolvedValueOnce({ run: { runId: 'run_1', pageId: 'page_a', status: 'reasoning' } })
      .mockResolvedValue({
        run: { runId: 'run_1', pageId: 'page_a', status: 'completed', resultWorkingVersion: 2 },
      });
    const hook = renderHook(() => useAgentChat('project_1', 'page_a'));
    await waitFor(() => expect(onClose).toBeDefined());
    vi.useFakeTimers();
    await act(async () => {
      onClose!();
      await vi.advanceTimersByTimeAsync(750);
    });
    expect(hook.result.current.activity).toBe('idle');
    expect(hook.result.current.state.messages).toEqual([userMessage, assistantMessage]);
    expect(mocks.subscribeAgentEvents).toHaveBeenCalledTimes(1);
  });

  it('retries the exact uncertain request after unmount without automatically resending', async () => {
    mocks.createAgentRun.mockRejectedValueOnce(new Error('connection lost')).mockResolvedValueOnce({
      conversationId: 'conversation_1',
      runId: 'run_1',
      status: 'completed',
      run: { runId: 'run_1', pageId: 'page_a', status: 'completed' },
    });
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
    mocks.workingState.mockResolvedValue({ revisionId: 'revision_2', workingVersion: 2 });
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
});
