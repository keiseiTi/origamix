import { useCallback, useEffect, useRef } from 'react';
import type { EditorHandle } from '@/components/editor';
import { useWorkspaceStore, type PageItem, type WorkspaceMode } from '@/store/workspace';
import { useWorkspaceTransitions } from './use-workspace-transitions';

export const useWorkspacePageController = ({
  onEnterEdit,
  onEnterChat,
  onPageSelected,
}: {
  onEnterEdit: () => void;
  onEnterChat: () => void;
  onPageSelected: () => void;
}) => {
  const editorRefs = useRef(new Map<string, { current: EditorHandle | null }>());

  const editorRefForPage = useCallback((pageId: string): { current: EditorHandle | null } => {
    let ref = editorRefs.current.get(pageId);
    if (!ref) {
      ref = { current: null };
      editorRefs.current.set(pageId, ref);
    }
    return ref;
  }, []);

  const flushEditor = useCallback(async (): Promise<void> => {
    const pageId = useWorkspaceStore.getState().activeTabId;
    if (pageId) await editorRefs.current.get(pageId)?.current?.flush();
  }, []);
  const { transition, transitionError } = useWorkspaceTransitions(flushEditor);

  useEffect(() => {
    const removeClosedRefs = (): void => {
      const openIds = new Set(useWorkspaceStore.getState().openPages.map((tab) => tab.id));
      for (const pageId of editorRefs.current.keys()) {
        if (!openIds.has(pageId)) editorRefs.current.delete(pageId);
      }
    };
    return useWorkspaceStore.subscribe(removeClosedRefs);
  }, []);

  const selectPage = (pageId: string): void => {
    useWorkspaceStore.getState().selectPage(pageId);
    onPageSelected();
  };

  const closePage = (pageId: string): void => {
    useWorkspaceStore.getState().closePage(pageId);
    editorRefs.current.delete(pageId);
  };

  const addPage = (projectId: string, page: PageItem): void => {
    useWorkspaceStore
      .getState()
      .setProjects((current) =>
        current.map((project) =>
          project.id === projectId ? { ...project, pages: [...project.pages, page] } : project,
        ),
      );
    void transition(() => selectPage(page.id));
  };

  const changeMode = async (pageId: string, mode: WorkspaceMode): Promise<void> =>
    transition(() => {
      const currentMode =
        useWorkspaceStore.getState().openPages.find((tab) => tab.id === pageId)?.mode ?? 'chat';
      if (mode === 'edit' && currentMode !== 'edit') onEnterEdit();
      if (mode === 'chat') onEnterChat();
      useWorkspaceStore.getState().setPageMode(pageId, mode);
    });

  const openPreview = async (pageId: string): Promise<void> => {
    await editorRefs.current.get(pageId)?.current?.flush();
    useWorkspaceStore.getState().setPageMode(pageId, 'preview');
  };

  return {
    editorRefForPage,
    flushEditor,
    transition,
    transitionError,
    selectPage,
    closePage,
    addPage,
    changeMode,
    openPreview,
  };
};
