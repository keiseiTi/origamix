import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { projectsService } from '../services/projects';
import { useWorkspaceStore, type PageItem, type ProjectItem } from '../store/workspace';

interface ProjectActionsInput {
  flushEditor: () => Promise<void>;
  onPageAdded: (projectId: string, page: PageItem) => void;
  onError: (message: string) => void;
}

export interface PendingProjectInitialization {
  directoryGrantId: string;
  displayPath: string;
}

export const useProjectActions = (input: ProjectActionsInput) => {
  const { projects, setProjects, replaceWorkspace, removePages } = useWorkspaceStore(
    useShallow((state) => ({
      projects: state.projects,
      setProjects: state.setProjects,
      replaceWorkspace: state.replaceWorkspace,
      removePages: state.removePages,
    })),
  );
  const [pendingInitialization, setPendingInitialization] =
    useState<PendingProjectInitialization | null>(null);
  const [initializing, setInitializing] = useState(false);

  const installOpenedProject = async (project: {
    id: string;
    name: string;
    path: string;
  }): Promise<void> => {
    const pages = await projectsService.pages(project.id);
    const opened: ProjectItem = {
      ...project,
      pages: pages.map((page) => ({ id: page.id, name: page.name, fileName: page.slug })),
    };
    setProjects((current) => [
      ...current.filter((item) => item.path !== opened.path && item.id !== opened.id),
      opened,
    ]);
    replaceWorkspace({
      activeProjectId: opened.id,
      activePageId: opened.pages[0]?.id ?? null,
      openPageIds: opened.pages[0] ? [opened.pages[0].id] : [],
      pageModes: {},
      pageDrafts: {},
      activeTab: 'chat',
    });
  };

  const openProject = async (): Promise<void> => {
    await input.flushEditor();
    const grant = await window.api?.dialog?.chooseExistingProject?.();
    if (!grant) return;
    const result = await projectsService.open({
      directoryGrantId: grant.directoryGrantId,
      pageDirectory: 'pages',
    });
    if (result.status === 'initialization_required') {
      setPendingInitialization({
        directoryGrantId: grant.directoryGrantId,
        displayPath: result.displayPath,
      });
      return;
    }
    await installOpenedProject(result.project);
  };

  const initializePendingProject = async (initializationInput: {
    name: string;
    code: string;
    pageDirectory: string;
  }): Promise<void> => {
    const pending = pendingInitialization;
    if (!pending) return;
    setInitializing(true);
    try {
      const result = await projectsService.open({
        name: initializationInput.name,
        code: initializationInput.code,
        directoryGrantId: pending.directoryGrantId,
        pageDirectory: initializationInput.pageDirectory,
        initializeIfNeeded: true,
      });
      if (result.status !== 'opened') throw new Error('项目初始化未完成');
      await installOpenedProject(result.project);
      setPendingInitialization(null);
    } catch (error) {
      input.onError(error instanceof Error ? error.message : '初始化失败');
    } finally {
      setInitializing(false);
    }
  };

  const renameProject = async (projectId: string, name: string): Promise<void> => {
    const project = await projectsService.rename(projectId, name);
    setProjects((current) =>
      current.map((item) => (item.id === projectId ? { ...item, name: project.name } : item)),
    );
  };

  const renamePage = async (projectId: string, pageId: string, name: string): Promise<void> => {
    const page = await projectsService.renamePage(projectId, pageId, name);
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? {
              ...project,
              pages: project.pages.map((item) =>
                item.id === pageId ? { ...item, name: page.name } : item,
              ),
            }
          : project,
      ),
    );
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    await input.flushEditor();
    const project = projects.find((item) => item.id === projectId);
    if (!project) return;
    await projectsService.delete(projectId);
    setProjects((current) => current.filter((item) => item.id !== projectId));
    removePages(project.pages.map((page) => page.id));
  };

  const deletePage = async (projectId: string, pageId: string): Promise<void> => {
    await input.flushEditor();
    await projectsService.deletePage(projectId, pageId);
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? { ...project, pages: project.pages.filter((page) => page.id !== pageId) }
          : project,
      ),
    );
    removePages([pageId]);
  };

  const duplicatePage = async (projectId: string, pageId: string): Promise<void> => {
    const page = await projectsService.duplicatePage(projectId, pageId);
    input.onPageAdded(projectId, { id: page.id, name: page.name, fileName: page.slug });
  };

  return {
    pendingInitialization,
    setPendingInitialization,
    initializing,
    openProject,
    initializePendingProject,
    renameProject,
    renamePage,
    deleteProject,
    deletePage,
    duplicatePage,
  };
};
