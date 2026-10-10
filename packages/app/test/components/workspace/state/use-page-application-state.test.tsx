// @vitest-environment happy-dom

import { act, cleanup, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorHandle } from '../../../../src/components/editor';

const schemaMocks = vi.hoisted(() => ({
  applyState: vi.fn(),
  workingState: vi.fn(),
  saveRevision: vi.fn(),
  apply: vi.fn(),
  reloadFromProject: vi.fn(),
  restoreRevision: vi.fn(),
}));

vi.mock('../../../../src/services/schema', () => ({ schemaService: schemaMocks }));

import { usePendingOperations } from '../../../../src/store/pending-operations';
import { usePageApplicationState } from '../../../../src/components/workspace/hooks/use-page-application-state';

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const editorRef = {
  current: { flush: vi.fn().mockResolvedValue(undefined) },
} as unknown as RefObject<EditorHandle | null>;

describe('usePageApplicationState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    vi.mocked(editorRef.current!.flush).mockResolvedValue(undefined);
    usePendingOperations.setState({ applies: {}, agents: {} });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('restores a selected Revision into Working without saving another Revision', async () => {
    schemaMocks.applyState.mockResolvedValue({ status: 'draft_unsaved' });
    schemaMocks.workingState.mockResolvedValue({
      revisionId: 'revision_current',
      workingVersion: 4,
    });
    schemaMocks.restoreRevision.mockResolvedValue({
      revisionId: 'revision_current',
      workingVersion: 5,
    });
    const onSchemaCommitted = vi.fn();
    const { result } = renderHook(() =>
      usePageApplicationState({
        projectId: 'project_1',
        pageId: 'page_a',
        schemaRefreshKey: 'working_4',
        editorRef,
        onSchemaCommitted,
      }),
    );

    await act(async () => result.current.restoreRevision('revision_old'));

    expect(schemaMocks.restoreRevision).toHaveBeenCalledWith(
      'project_1',
      'page_a',
      'revision_old',
      4,
    );
    expect(onSchemaCommitted).toHaveBeenCalledWith('page_a', 'working_restore_5');
    expect(schemaMocks.saveRevision).not.toHaveBeenCalled();
  });

  it('ignores an old apply-state response after the same page advances to a new Revision', async () => {
    const previous = deferred<{ status: 'external_change' }>();
    schemaMocks.applyState
      .mockReturnValueOnce(previous.promise)
      .mockResolvedValue({ status: 'saved_pending_apply' });
    const hook = renderHook(
      ({ revision }) =>
        usePageApplicationState({
          projectId: 'project_1',
          pageId: 'page_a',
          schemaRefreshKey: revision,
          editorRef,
          onSchemaCommitted: vi.fn(),
        }),
      { initialProps: { revision: 'revision_1' } },
    );

    await act(async () => vi.advanceTimersByTime(0));
    hook.rerender({ revision: 'revision_2' });
    await act(async () => vi.advanceTimersByTime(0));
    await act(async () => previous.resolve({ status: 'external_change' }));

    expect(hook.result.current.applyStatus).toBe('saved_pending_apply');
  });

  it('does not publish a reload result after leaving its page', async () => {
    schemaMocks.applyState.mockResolvedValue({ status: 'in_sync' });
    const reload = deferred<{ revisionId: string }>();
    schemaMocks.reloadFromProject.mockReturnValue(reload.promise);
    const onSchemaCommitted = vi.fn();
    const { result, rerender } = renderHook(
      ({ pageId }) =>
        usePageApplicationState({
          projectId: 'project_1',
          pageId,
          schemaRefreshKey: 'revision_1',
          editorRef,
          onSchemaCommitted,
        }),
      { initialProps: { pageId: 'page_a' } },
    );

    const request = result.current.reloadFromProject();
    rerender({ pageId: 'page_b' });
    await act(async () => reload.resolve({ revisionId: 'revision_page_a' }));
    await request;

    expect(onSchemaCommitted).not.toHaveBeenCalled();
  });

  it('flushes the Working draft and explicitly saves a Revision', async () => {
    schemaMocks.applyState.mockResolvedValue({ status: 'saved_pending_apply' });
    schemaMocks.workingState.mockResolvedValue({
      revisionId: 'revision_old',
      workingVersion: 3,
    });
    schemaMocks.saveRevision.mockResolvedValue({
      revisionId: 'revision_saved',
      workingVersion: 3,
    });
    const onSchemaCommitted = vi.fn();
    const { result } = renderHook(() =>
      usePageApplicationState({
        projectId: 'project_1',
        pageId: 'page_a',
        schemaRefreshKey: 'revision_old',
        editorRef,
        onSchemaCommitted,
      }),
    );

    await act(async () => result.current.saveVersion());

    expect(editorRef.current!.flush).toHaveBeenCalledOnce();
    expect(schemaMocks.saveRevision).toHaveBeenCalledWith('project_1', 'page_a', 3);
    expect(onSchemaCommitted).toHaveBeenCalledWith('page_a', 'revision_saved');
  });
  it('keeps an ambiguous Apply across unmount, then clears it on explicit retry', async () => {
    schemaMocks.applyState.mockResolvedValue({ status: 'saved_pending_apply' });
    schemaMocks.workingState.mockResolvedValue({ revisionId: 'revision_1', workingVersion: 1 });
    schemaMocks.apply.mockRejectedValueOnce(new Error('connection lost')).mockResolvedValueOnce({});
    const usePage = () =>
      usePageApplicationState({
        projectId: 'project_1',
        pageId: 'page_a',
        schemaRefreshKey: 'revision_1',
        editorRef,
        onSchemaCommitted: vi.fn(),
      });
    const first = renderHook(usePage);
    await act(async () => {
      await expect(first.result.current.applyPage()).rejects.toThrow();
    });
    first.unmount();
    schemaMocks.workingState.mockResolvedValue({ revisionId: 'revision_2', workingVersion: 2 });
    const next = renderHook(usePage);
    await act(async () => vi.advanceTimersByTime(1500));
    expect(next.result.current.applyStatus).toBe('result_pending');
    expect(schemaMocks.apply).toHaveBeenCalledTimes(1);
    await act(async () => next.result.current.applyPage());
    expect(schemaMocks.apply.mock.calls[1]![4]).toBe(schemaMocks.apply.mock.calls[0]![4]);
    expect(schemaMocks.apply.mock.calls[1]![2]).toBe('revision_1');
    expect(schemaMocks.apply.mock.calls[1]![3]).toBe(1);
    expect(usePendingOperations.getState().applies).toEqual({});
    next.unmount();
  });
});
