// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { OrigamixPageSchema } from '@origamix/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const schemaMocks = vi.hoisted(() => ({
  workingState: vi.fn(),
  updateWorking: vi.fn(),
  applyWorkingOperations: vi.fn(),
}));

vi.mock('../../../src/services/schema', () => ({ schemaService: schemaMocks }));

import { useEditorSession } from '../../../src/components/editor/use-editor-session';

const schema: OrigamixPageSchema = {
  elements: { element_root: { type: 'container', props: {} } },
  layout: { root: 'element_root', structure: { element_root: [] } },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: '1.0' } },
};

describe('useEditorSession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    schemaMocks.workingState.mockResolvedValue({
      schema,
      revisionId: 'revision_saved',
      workingVersion: 4,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('retains visual edits in Working without creating a Revision', async () => {
    const next = structuredClone(schema);
    next.elements.element_root!.props = { padding: 24 };
    schemaMocks.applyWorkingOperations.mockResolvedValue({
      schema: next,
      revisionId: 'revision_saved',
      workingVersion: 5,
    });
    const onWorkingCommitted = vi.fn();
    const hook = renderHook(
      ({ ready }) => useEditorSession('project_one', 'page_one', false, onWorkingCommitted, ready),
      { initialProps: { ready: false } },
    );
    await act(async () => Promise.resolve());
    await waitFor(() => expect(hook.result.current.initial).not.toBeNull());
    // Slow material loading must not admit engine bootstrap snapshots as edits.
    act(() => hook.result.current.onChange(next));
    await act(async () => hook.result.current.flush());
    expect(schemaMocks.applyWorkingOperations).not.toHaveBeenCalled();
    hook.rerender({ ready: true });
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));

    act(() => hook.result.current.onChange(next, { immediate: true }));
    expect(onWorkingCommitted).not.toHaveBeenCalled();
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));

    expect(schemaMocks.applyWorkingOperations).toHaveBeenCalledWith('project_one', 'page_one', 4, [
      { operation: 'updateElementProps', elementId: 'element_root', set: { padding: 24 } },
    ]);
    expect(schemaMocks.updateWorking).not.toHaveBeenCalled();
    expect(hook.result.current.initial?.revisionId).toBe('revision_saved');
    expect(onWorkingCommitted).toHaveBeenCalledTimes(1);
  });

  // App owns this queue: Server cannot prove that a rejected UI flush retains
  // its local candidate or that typing avoids replaying an ambiguous write.
  it('retains a rejected draft, blocks automatic replay and allows an explicit flush', async () => {
    const next = structuredClone(schema);
    next.elements.element_root!.props = { padding: 32 };
    schemaMocks.applyWorkingOperations
      .mockRejectedValueOnce(new Error('连接中断'))
      .mockResolvedValueOnce({ schema: next, revisionId: 'revision_saved', workingVersion: 5 });
    const hook = renderHook(() => useEditorSession('project_one', 'page_one', false));
    await waitFor(() => expect(hook.result.current.initial).not.toBeNull());
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));
    vi.useFakeTimers();
    const first = structuredClone(schema);
    first.elements.element_root!.props = { padding: 24 };
    act(() => hook.result.current.onChange(first));
    await act(async () => {
      await expect(hook.result.current.flush()).rejects.toThrow('连接中断');
    });
    expect(hook.result.current.error).toBe('连接中断');
    act(() => hook.result.current.onChange(next, { immediate: true }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(schemaMocks.applyWorkingOperations).toHaveBeenCalledTimes(1);
    await act(async () => hook.result.current.flush());
    expect(schemaMocks.applyWorkingOperations).toHaveBeenLastCalledWith(
      'project_one',
      'page_one',
      4,
      [{ operation: 'updateElementProps', elementId: 'element_root', set: { padding: 32 } }],
    );
    expect(hook.result.current.error).toBeNull();
    expect(schemaMocks.updateWorking).not.toHaveBeenCalled();
  });

  // The extracted view may be rebound to another page while HTTP is pending.
  // Only App can reject that old completion before updating its session projection.
  it('ignores a pending completion after the page scope changes', async () => {
    const next = structuredClone(schema);
    next.elements.element_root!.props = { padding: 24 };
    let finishOld!: (result: {
      schema: OrigamixPageSchema;
      revisionId: string;
      workingVersion: number;
    }) => void;
    schemaMocks.applyWorkingOperations
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          }),
      )
      .mockResolvedValueOnce({ schema: next, revisionId: 'revision_second', workingVersion: 10 });
    const onWorkingCommitted = vi.fn();
    const hook = renderHook(
      ({ pageId }) => useEditorSession('project_one', pageId, false, onWorkingCommitted),
      { initialProps: { pageId: 'page_one' } },
    );
    await waitFor(() => expect(hook.result.current.initial).not.toBeNull());
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));
    let pending!: Promise<unknown>;
    act(() => {
      hook.result.current.onChange(next);
      pending = hook.result.current.flush().catch((reason: unknown) => reason);
    });
    schemaMocks.workingState.mockResolvedValueOnce({
      schema,
      revisionId: 'revision_second',
      workingVersion: 9,
    });
    hook.rerender({ pageId: 'page_two' });
    await waitFor(() => expect(hook.result.current.initial?.workingVersion).toBe(9));
    await act(async () => new Promise((resolve) => window.setTimeout(resolve, 0)));
    await act(async () => {
      finishOld({ schema: next, revisionId: 'revision_saved', workingVersion: 5 });
      await pending;
    });
    expect(await pending).toBeInstanceOf(Error);
    expect(onWorkingCommitted).not.toHaveBeenCalled();
    act(() => hook.result.current.onChange(next));
    await act(async () => hook.result.current.flush());
    expect(schemaMocks.applyWorkingOperations).toHaveBeenLastCalledWith(
      'project_one',
      'page_two',
      9,
      [{ operation: 'updateElementProps', elementId: 'element_root', set: { padding: 24 } }],
    );
    expect(onWorkingCommitted).toHaveBeenCalledTimes(1);
  });
});
