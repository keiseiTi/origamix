import { useCallback, useEffect, useRef } from 'react';
import type { EditorHandle } from '@origamix/editor';
import { useWorkspaceStore, type PageItem, type WorkspaceMode } from '@/store/workspace';
import { useWorkspaceTransitions } from './use-workspace-transitions';

export const useWorkspacePageController = ({ onPageSelected }: { onPageSelected: () => void }) => {
  const editorRefs = useRef(new Map<string, { current: EditorHandle | null }>());

  const editorRefForPage = useCallback((pageId: string): { current: EditorHandle | null } => {
    let ref = editorRefs.current.get(pageId);
    if (!ref) {
      ref = { current: null };
      editorRefs.current.set(pageId, ref);
    }
    return ref;
  }, []);

  const flushEditor = useCallback(
    async (pageId = useWorkspaceStore.getState().activeTabId): Promise<void> => {
      if (pageId) await editorRefs.current.get(pageId)?.current?.flush();
    },
    [],
  );
  const flushForTransition = useCallback(
    async (targetPageId?: string): Promise<void> => {
      const activePageId = useWorkspaceStore.getState().activeTabId;
      // Closing or previewing an inactive tab must also flush that tab's editor.
      const pageIds = new Set([activePageId, targetPageId]);
      for (const pageId of pageIds) if (pageId) await flushEditor(pageId);
    },
    [flushEditor],
  );
  const { transition, transitionError } = useWorkspaceTransitions(flushForTransition);

  useEffect(() => {
    const removeClosedRefs = (): void => {
      const openIds = new Set(useWorkspaceStore.getState().openPages.map((tab) => tab.id));
      for (const pageId of editorRefs.current.keys()) {
        if (!openIds.has(pageId)) editorRefs.current.delete(pageId);
      }
    };
    return useWorkspaceStore.subscribe(removeClosedRefs);
  }, []);

  const selectPage = (pageId: string): Promise<void> =>
    transition(() => {
      useWorkspaceStore.getState().selectPage(pageId);
      onPageSelected();
    }, pageId);

  const closePage = (pageId: string): Promise<void> =>
    transition(() => {
      useWorkspaceStore.getState().closePage(pageId);
      editorRefs.current.delete(pageId);
    }, pageId);

  const addPage = (projectId: string, page: PageItem): void => {
    useWorkspaceStore
      .getState()
      .setProjects((current) =>
        current.map((project) =>
          project.id === projectId ? { ...project, pages: [...project.pages, page] } : project,
        ),
      );
    void selectPage(page.id);
  };

  const changeMode = async (pageId: string, mode: WorkspaceMode): Promise<void> =>
    transition(() => {
      useWorkspaceStore.getState().setPageMode(pageId, mode);
    }, pageId);

  const openPreview = (pageId: string): Promise<void> =>
    transition(async () => {
      const state = useWorkspaceStore.getState();
      const projectId = state.openPages.find((tab) => tab.id === pageId)?.projectId;
      // A full-application preview must include retained drafts from every open
      // page/layout in this project. A failed flush keeps the current view intact.
      for (const tab of state.openPages) {
        if (tab.projectId === projectId) await flushEditor(tab.id);
      }
      useWorkspaceStore.getState().setPageMode(pageId, 'preview');
    }, pageId);

  return {
    editorRefForPage,
    flushEditor,
    transitionError,
    selectPage,
    closePage,
    addPage,
    changeMode,
    openPreview,
  };
};
