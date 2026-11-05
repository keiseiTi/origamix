// @vitest-environment happy-dom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWorkspacePageController } from '../../src/hooks/use-workspace-page-controller';
import { useWorkspaceStore } from '../../src/store/workspace';

afterEach(() => {
  cleanup();
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true);
});

describe('workspace page operations', () => {
  it('retains pages on failed saves and shares the save barrier across selection, closing and preview', async () => {
    const pages = [
      { id: 'a', name: 'A', fileName: 'a' },
      { id: 'b', name: 'B', fileName: 'b' },
    ];
    useWorkspaceStore.setState({
      projects: [{ id: 'project', name: 'Project', path: '/project', pages }],
      openPages: pages.map((page) => ({
        ...page,
        projectId: 'project',
        mode: 'edit',
        status: null,
      })),
      activeTabId: 'a',
      pageDrafts: { a: 'retained draft' },
    });
    const onPageSelected = vi.fn();
    const firstSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('save failed'))
      .mockResolvedValue(undefined);
    const secondSave = vi.fn().mockResolvedValue(undefined);
    const hook = renderHook(() => useWorkspacePageController({ onPageSelected }));
    hook.result.current.editorRefForPage('a').current = {
      flush: firstSave,
    };
    hook.result.current.editorRefForPage('b').current = {
      flush: secondSave,
    };

    await act(async () => hook.result.current.selectPage('b'));
    expect(useWorkspaceStore.getState().activeTabId).toBe('a');
    expect(useWorkspaceStore.getState().pageDrafts.a).toBe('retained draft');
    expect(hook.result.current.transitionError).toBe('save failed');
    expect(onPageSelected).not.toHaveBeenCalled();
    await act(async () => hook.result.current.selectPage('b'));
    expect(useWorkspaceStore.getState().activeTabId).toBe('b');
    expect(onPageSelected).toHaveBeenCalledOnce();
    expect(hook.result.current.transitionError).toBeNull();

    let release!: () => void;
    firstSave.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    let closing!: Promise<void>;
    await act(async () => {
      closing = hook.result.current.closePage('a');
    });
    expect(firstSave).toHaveBeenCalledTimes(3);
    expect(useWorkspaceStore.getState().openPages).toHaveLength(2);
    const savesBeforePreview = secondSave.mock.calls.length;
    await act(async () => hook.result.current.openPreview('b'));
    expect(secondSave).toHaveBeenCalledTimes(savesBeforePreview);
    expect(useWorkspaceStore.getState().openPages.find((page) => page.id === 'b')?.mode).toBe(
      'edit',
    );
    await act(async () => {
      release();
      await closing;
    });
    expect(useWorkspaceStore.getState().openPages.map((page) => page.id)).toEqual(['b']);

    secondSave.mockRejectedValueOnce(new Error('preview save failed'));
    await act(async () => hook.result.current.openPreview('b'));
    expect(hook.result.current.transitionError).toBe('preview save failed');
    expect(useWorkspaceStore.getState().openPages[0]?.mode).toBe('edit');
    await act(async () => hook.result.current.openPreview('b'));
    expect(useWorkspaceStore.getState().openPages[0]?.mode).toBe('preview');
    expect(hook.result.current.transitionError).toBeNull();

    // Only the browser owns unsent drafts in retained editors: the preview
    // barrier must include an inactive layout, without touching other projects.
    useWorkspaceStore.setState((state) => ({
      openPages: [
        { ...state.openPages[0]!, mode: 'edit' },
        {
          id: 'layout:project',
          projectId: 'project',
          kind: 'layout',
          name: '布局配置',
          fileName: '',
          mode: 'edit',
          status: null,
        },
        {
          id: 'other',
          projectId: 'other_project',
          name: 'Other',
          fileName: 'other',
          mode: 'edit',
          status: null,
        },
      ],
    }));
    const layoutSave = vi
      .fn()
      .mockRejectedValueOnce(new Error('layout draft failed'))
      .mockResolvedValue(undefined);
    const otherSave = vi.fn();
    hook.result.current.editorRefForPage('layout:project').current = { flush: layoutSave };
    hook.result.current.editorRefForPage('other').current = { flush: otherSave };
    await act(async () => hook.result.current.openPreview('b'));
    expect(hook.result.current.transitionError).toBe('layout draft failed');
    expect(useWorkspaceStore.getState().openPages[0]?.mode).toBe('edit');
    expect(otherSave).not.toHaveBeenCalled();
    await act(async () => hook.result.current.openPreview('b'));
    expect(useWorkspaceStore.getState().openPages[0]?.mode).toBe('preview');
    expect(layoutSave).toHaveBeenCalledTimes(2);
    expect(otherSave).not.toHaveBeenCalled();
  });
});
