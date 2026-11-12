import { useCallback } from 'react';
import {
  flushEditor,
  runWorkspaceTransition,
  useWorkspaceStore,
  type PageItem,
} from '@/store/workspace';

export const useWorkspacePageController = ({ onPageSelected }: { onPageSelected: () => void }) => {
  const selectPage = useCallback(
    (pageId: string): Promise<void> =>
      runWorkspaceTransition(pageId, () => {
        useWorkspaceStore.getState().selectPage(pageId);
        onPageSelected();
      }),
    [onPageSelected],
  );

  const closePage = (pageId: string): Promise<void> =>
    runWorkspaceTransition(pageId, () => useWorkspaceStore.getState().closePage(pageId));

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

  return { flushEditor, selectPage, closePage, addPage };
};
