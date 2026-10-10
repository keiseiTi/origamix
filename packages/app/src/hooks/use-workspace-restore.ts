import { useEffect } from 'react';
import { projectsService } from '@/services/projects';
import { useWorkspaceStore } from '@/store/workspace';

export const useWorkspaceRestore = (): boolean => {
  const workspaceReady = useWorkspaceStore((state) => state.workspaceReady);

  useEffect(() => {
    let active = true;
    const restore = async (): Promise<void> => {
      try {
        const projectRecords = await projectsService.list();
        const projects = await Promise.all(
          projectRecords.map(async (project) => ({
            id: project.id,
            name: project.name,
            path: project.path,
            pages: (await projectsService.pages(project.id)).map((page) => ({
              id: page.id,
              name: page.name,
              fileName: page.slug,
            })),
          })),
        );
        if (active) useWorkspaceStore.getState().restoreWorkspace(projects);
      } catch (error) {
        if (active)
          useWorkspaceStore
            .getState()
            .failWorkspaceRestore(error instanceof Error ? error.message : '无法恢复工作区');
      }
    };
    void restore();
    return () => {
      active = false;
    };
  }, []);

  return workspaceReady;
};
