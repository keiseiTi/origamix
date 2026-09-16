// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorHandle } from '../../../../src/components/editor';

const schemaMocks = vi.hoisted(() => ({
  applyState: vi.fn(),
  get: vi.fn(),
  apply: vi.fn(),
  reloadFromProject: vi.fn(),
}));

vi.mock('../../../../src/services/schema', () => ({ schemaService: schemaMocks }));

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
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
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
    schemaMocks.get.mockResolvedValue({ revisionId: 'revision_page_a' });
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
    schemaMocks.applyState.mockResolvedValue({ status: 'pending' });
    schemaMocks.get.mockResolvedValue({ revisionId: 'revision_1' });
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
    expect(schemaMocks.apply.mock.calls[1]![3]).toBe(schemaMocks.apply.mock.calls[0]![3]);
  });
});
