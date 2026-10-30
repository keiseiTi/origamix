import { subscribeBackendReady } from '@/services/request';
import { useEffect } from 'react';
import { projectsService } from '@/services/projects';
import { useWorkspaceStore } from '@/store/workspace';

export const useWorkspaceRestore = (): boolean => {
  const workspaceReady = useWorkspaceStore((state) => state.workspaceReady);

  useEffect(() => {
    let active = true;
    let sequence = 0;
    const restore = async (): Promise<void> => {
      const request = ++sequence;
      try {
        const projectRecords = await projectsService.list();
        const projects = projectRecords.map((project) => ({
          id: project.id,
          name: project.name,
          path: project.path,
          pages: project.pages.map((page) => ({
            id: page.id,
            name: page.name,
            fileName: page.slug,
          })),
        }));
        if (active && request === sequence) useWorkspaceStore.getState().restoreWorkspace(projects);
      } catch (error) {
        if (active && request === sequence)
          useWorkspaceStore
            .getState()
            .failWorkspaceRestore(error instanceof Error ? error.message : '无法恢复工作区');
      }
    };
    void restore();
    const unsubscribe = subscribeBackendReady(() => void restore());
    return () => {
      unsubscribe();
      active = false;
    };
  }, []);

  return workspaceReady;
};
