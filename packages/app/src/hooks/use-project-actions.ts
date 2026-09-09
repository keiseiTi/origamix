import { useState, type Dispatch, type SetStateAction } from 'react';
import type { PageItem, ProjectItem } from '../components/sidebar';
import type { ViewSession } from '../store/view-session';
import { projectsService } from '../services/projects';

interface ProjectActionsInput {
  projects: ProjectItem[];
  setProjects: Dispatch<SetStateAction<ProjectItem[]>>;
  selectedPageId: string | null;
  openPageIds: string[];
  pageModes: ViewSession['pageModes'];
  pageDrafts: ViewSession['pageDrafts'];
  updateWorkspace: (patch: Partial<ViewSession>) => void;
  setActiveTab: (mode: ViewSession['activeTab']) => void;
  flushEditor: () => Promise<void>;
  onPageAdded: (projectId: string, page: PageItem) => void;
  onError: (message: string) => void;
}

export function useProjectActions(input: ProjectActionsInput) {
  const [pendingInitialization, setPendingInitialization] = useState<{
    directoryGrantId: string;
    displayPath: string;
  } | null>(null);
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
    input.setProjects((current) => [
      ...current.filter((item) => item.path !== opened.path && item.id !== opened.id),
      opened,
    ]);
    input.updateWorkspace({
      activeProjectId: opened.id,
      activePageId: opened.pages[0]?.id ?? null,
      openPageIds: opened.pages[0] ? [opened.pages[0].id] : [],
      pageModes: {},
      pageDrafts: {},
    });
    input.setActiveTab('chat');
  };

  const openProject = async (): Promise<void> => {
    await input.flushEditor();
    const grant = await window.api?.dialog?.chooseExistingProject?.();
    if (!grant) return;
    const result = await projectsService.open({ directoryGrantId: grant.directoryGrantId });
    if (result.status === 'initialization_required') {
      setPendingInitialization({
        directoryGrantId: grant.directoryGrantId,
        displayPath: result.displayPath,
      });
      return;
    }
    await installOpenedProject(result.project);
  };

  const initializePendingProject = async (): Promise<void> => {
    const pending = pendingInitialization;
    if (!pending) return;
    setInitializing(true);
    try {
      const result = await projectsService.open({
        directoryGrantId: pending.directoryGrantId,
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
    input.setProjects((current) =>
      current.map((item) => (item.id === projectId ? { ...item, name: project.name } : item)),
    );
  };

  const renamePage = async (projectId: string, pageId: string, name: string): Promise<void> => {
    const page = await projectsService.renamePage(projectId, pageId, name);
    input.setProjects((current) =>
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

  const removePagesFromSession = (removedIds: Set<string>): void => {
    const remaining = input.openPageIds.filter((id) => !removedIds.has(id));
    const nextModes = Object.fromEntries(
      Object.entries(input.pageModes).filter(([id]) => !removedIds.has(id)),
    );
    const nextDrafts = Object.fromEntries(
      Object.entries(input.pageDrafts).filter(([id]) => !removedIds.has(id)),
    );
    const nextPageId =
      input.selectedPageId && !removedIds.has(input.selectedPageId)
        ? input.selectedPageId
        : (remaining[0] ?? null);
    const nextProjectId =
      input.projects.find((project) => project.pages.some((page) => page.id === nextPageId))?.id ??
      null;
    input.updateWorkspace({
      activeProjectId: nextProjectId,
      activePageId: nextPageId,
      openPageIds: remaining,
      pageModes: nextModes,
      pageDrafts: nextDrafts,
    });
    input.setActiveTab(nextPageId && nextModes[nextPageId] === 'edit' ? 'edit' : 'chat');
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    await input.flushEditor();
    const project = input.projects.find((item) => item.id === projectId);
    if (!project) return;
    for (const page of project.pages) {
      await window.api?.window?.closePreview?.({ projectId, pageId: page.id, mode: 'preview' });
    }
    await projectsService.delete(projectId);
    input.setProjects((current) => current.filter((item) => item.id !== projectId));
    removePagesFromSession(new Set(project.pages.map((page) => page.id)));
  };

  const deletePage = async (projectId: string, pageId: string): Promise<void> => {
    await input.flushEditor();
    await window.api?.window?.closePreview?.({ projectId, pageId, mode: 'preview' });
    await projectsService.deletePage(projectId, pageId);
    input.setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? { ...project, pages: project.pages.filter((page) => page.id !== pageId) }
          : project,
      ),
    );
    removePagesFromSession(new Set([pageId]));
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
}
