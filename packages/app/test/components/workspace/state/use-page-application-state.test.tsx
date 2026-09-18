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
import { usePageApplicationState } from '../../../../src/components/workspace/state/use-page-application-state';

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

  it('ignores a polling result that returns after switching pages', async () => {
    const pageA = deferred<{ status: 'external_change' }>();
    schemaMocks.applyState.mockImplementation((_projectId: string, pageId: string) =>
      pageId === 'page_a' ? pageA.promise : Promise.resolve({ status: 'in_sync' }),
    );
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

    await act(async () => vi.advanceTimersByTime(0));
    rerender({ pageId: 'page_b' });
    await act(async () => vi.advanceTimersByTime(0));
    expect(result.current.applyStatus).toBe('in_sync');

    await act(async () => pageA.resolve({ status: 'external_change' }));
    expect(result.current.applyStatus).toBe('in_sync');
  });

  it('does not publish a reload result to the page opened later', async () => {
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

  it('does not publish a late Apply failure to the page opened later', async () => {
    schemaMocks.applyState.mockResolvedValue({ status: 'in_sync' });
    schemaMocks.workingState.mockResolvedValue({
      revisionId: 'revision_page_a',
      workingVersion: 1,
    });
    const apply = deferred<unknown>();
    schemaMocks.apply.mockReturnValue(apply.promise);
    const { result, rerender } = renderHook(
      ({ pageId }) =>
        usePageApplicationState({
          projectId: 'project_1',
          pageId,
          schemaRefreshKey: 'revision_1',
          editorRef,
          onSchemaCommitted: vi.fn(),
        }),
      { initialProps: { pageId: 'page_a' } },
    );

    const request = result.current.applyPage();
    await act(async () => Promise.resolve());
    expect(schemaMocks.apply).toHaveBeenCalledOnce();
    rerender({ pageId: 'page_b' });
    await act(async () => vi.advanceTimersByTime(0));
    expect(result.current.applyStatus).toBe('in_sync');

    const settled = request.catch((error: unknown) => error);
    await act(async () => apply.reject(new Error('late failure')));
    await expect(settled).resolves.toMatchObject({ message: 'late failure' });
    expect(result.current.applyStatus).toBe('in_sync');
  });

  it('reuses the request ID when an Apply result is ambiguous for the same revision', async () => {
    schemaMocks.applyState.mockResolvedValue({ status: 'saved_pending_apply' });
    schemaMocks.workingState.mockResolvedValue({ revisionId: 'revision_1', workingVersion: 1 });
    schemaMocks.apply.mockRejectedValueOnce(new Error('connection lost')).mockResolvedValueOnce({});
    const { result } = renderHook(() =>
      usePageApplicationState({
        projectId: 'project_1',
        pageId: 'page_a',
        schemaRefreshKey: 'revision_1',
        editorRef,
        onSchemaCommitted: vi.fn(),
      }),
    );

    await act(async () => {
      await expect(result.current.applyPage()).rejects.toThrow('connection lost');
    });
    expect(result.current.applyStatus).toBe('result_pending');
    await act(async () => result.current.applyPage());

    expect(schemaMocks.apply).toHaveBeenCalledTimes(2);
    expect(schemaMocks.apply.mock.calls[1]![4]).toBe(schemaMocks.apply.mock.calls[0]![4]);
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
  it('keeps an ambiguous Apply across unmount and polling, then clears it on explicit retry', async () => {
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
  it.each(['success', 'failure'] as const)(
    'ignores an old polling %s after refreshing the same page revision',
    async (outcome) => {
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
      expect(hook.result.current.applyStatus).toBe('saved_pending_apply');
      await act(async () => {
        if (outcome === 'success') previous.resolve({ status: 'external_change' });
        else previous.reject(new Error('old polling failure'));
      });
      expect(hook.result.current.applyStatus).toBe('saved_pending_apply');
    },
  );

  it('keeps the newest polling failure visible when an older request succeeds later', async () => {
    const previous = deferred<{ status: 'in_sync' }>();
    schemaMocks.applyState
      .mockReturnValueOnce(previous.promise)
      .mockRejectedValue(new Error('latest failure'));
    const hook = renderHook(() =>
      usePageApplicationState({
        projectId: 'project_1',
        pageId: 'page_a',
        schemaRefreshKey: 'revision_1',
        editorRef,
        onSchemaCommitted: vi.fn(),
      }),
    );
    await act(async () => vi.advanceTimersByTime(0));
    await act(async () => vi.advanceTimersByTime(1500));
    expect(hook.result.current.applyStatus).toBe('error');
    await act(async () => previous.resolve({ status: 'in_sync' }));
    expect(hook.result.current.applyStatus).toBe('error');
  });

  it('invalidates an old response when returning to a page before its next poll starts', async () => {
    const previous = deferred<{ status: 'external_change' }>();
    schemaMocks.applyState
      .mockReturnValueOnce(previous.promise)
      .mockResolvedValue({ status: 'saved_pending_apply' });
    const hook = renderHook(
      ({ pageId }) =>
        usePageApplicationState({
          projectId: 'project_1',
          pageId,
          schemaRefreshKey: 'revision_1',
          editorRef,
          onSchemaCommitted: vi.fn(),
        }),
      { initialProps: { pageId: 'page_a' } },
    );
    await act(async () => vi.advanceTimersByTime(0));
    hook.rerender({ pageId: 'page_b' });
    hook.rerender({ pageId: 'page_a' });
    await act(async () => previous.resolve({ status: 'external_change' }));
    expect(hook.result.current.applyStatus).toBe('loading');
    await act(async () => vi.advanceTimersByTime(0));
    expect(hook.result.current.applyStatus).toBe('saved_pending_apply');
  });
  it('continues updating on a slow connection while the next poll is pending', async () => {
    const first = deferred<{ status: 'saved_pending_apply' }>();
    const second = deferred<{ status: 'in_sync' }>();
    schemaMocks.applyState.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const hook = renderHook(() =>
      usePageApplicationState({
        projectId: 'project_1',
        pageId: 'page_a',
        schemaRefreshKey: 'revision_1',
        editorRef,
        onSchemaCommitted: vi.fn(),
      }),
    );
    await act(async () => vi.advanceTimersByTime(0));
    await act(async () => vi.advanceTimersByTime(1500));
    await act(async () => first.resolve({ status: 'saved_pending_apply' }));
    expect(hook.result.current.applyStatus).toBe('saved_pending_apply');
    await act(async () => second.resolve({ status: 'in_sync' }));
    expect(hook.result.current.applyStatus).toBe('in_sync');
  });
});
