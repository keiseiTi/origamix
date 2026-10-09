import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Sidebar } from '@/components/sidebar';
import { CreateProjectModal } from '@/components/sidebar/mod/create-project-modal';
import { SettingsModal } from '@/components/settings';
import { Workspace } from '@/components/workspace';
import { EmptyWorkspace } from '@/components/workspace/empty-workspace';
import { PageTabs } from '@/components/workspace/page-tabs';
import type { EditorHandle } from '@/components/editor';
import type { WorkspaceMode } from '@/components/workspace';
import { projectsService } from '@/services/projects';
import { useAppPreferences } from '@/hooks/use-app-preferences';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';
import { useWorkspaceTransitions } from '@/hooks/use-workspace-transitions';
import { usePreferencesStore } from '@/store/preferences';
import { useWorkspaceStore, type PageItem } from '@/store/workspace';
import { isMacDesktop } from '@/utils';

const App = (): React.JSX.Element => {
  const macDesktop = isMacDesktop();
  const {
    projects,
    setProjects,
    sessionSidebarCollapsed,
    setSidebarCollapsed,
    selectedPageId,
    openPages,
    selectWorkspacePage,
    closeWorkspacePage,
    restoreWorkspace,
    failWorkspaceRestore,
    workspaceReady,
    workspaceError,
  } = useWorkspaceStore(
    useShallow((state) => ({
      projects: state.projects,
      setProjects: state.setProjects,
      sessionSidebarCollapsed: state.sidebarCollapsed,
      setSidebarCollapsed: state.setSidebarCollapsed,
      selectedPageId: state.activeTabId,
      openPages: state.openPages,
      selectWorkspacePage: state.selectPage,
      closeWorkspacePage: state.closePage,
      restoreWorkspace: state.restoreWorkspace,
      failWorkspaceRestore: state.failWorkspaceRestore,
      workspaceReady: state.workspaceReady,
      workspaceError: state.workspaceError,
    })),
  );
  const sidebarCollapsed = sessionSidebarCollapsed ?? false;
  const [sidebarPeek, setSidebarPeek] = useState(false);
  const [sidebarPeekEnabled, setSidebarPeekEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'general' | 'model'>('general');
  const theme = usePreferencesStore((state) => state.theme);
  useAppPreferences();
  const [isHomeProjectModalOpen, setIsHomeProjectModalOpen] = useState(false);
  const [editorRefs] = useState(() => {
    const refs = new Map<string, { current: EditorHandle | null }>();
    const initialPageId = useWorkspaceStore.getState().activeTabId;
    if (initialPageId) refs.set(initialPageId, { current: null });
    return refs;
  });
  const [schemaRefreshKeys, setSchemaRefreshKeys] = useState<Record<string, string>>({});
  const [mountedPageIds, setMountedPageIds] = useState<string[]>(() => {
    const initialPageId = useWorkspaceStore.getState().activeTabId;
    return initialPageId ? [initialPageId] : [];
  });
  const sidebarVisible = !sidebarCollapsed || sidebarPeek;
  const mountedPages = mountedPageIds.flatMap((pageId) => {
    const project = projects.find((item) => item.pages.some((page) => page.id === pageId));
    const page = project?.pages.find((item) => item.id === pageId);
    return project && page ? [{ pageId }] : [];
  });

  const editorRefForPage = (pageId: string): { current: EditorHandle | null } => {
    const existing = editorRefs.get(pageId);
    if (!existing) throw new Error(`页面 ${pageId} 尚未初始化编辑器引用`);
    return existing;
  };

  const openSettings = useCallback((): void => {
    setSidebarPeek(false);
    setSettingsSection('general');
    setIsSettingsOpen(true);
  }, []);

  const openModelSettings = (): void => {
    setSidebarPeek(false);
    setSettingsSection('model');
    setIsSettingsOpen(true);
  };

  const closeSettings = (): void => {
    setIsSettingsOpen(false);
  };

  useGlobalShortcuts(macDesktop, openSettings);

  const flushEditor = useCallback(async (): Promise<void> => {
    if (!selectedPageId) return;
    await editorRefs.get(selectedPageId)?.current?.flush();
  }, [editorRefs, selectedPageId]);
  const { transition, transitionError } = useWorkspaceTransitions(flushEditor);
  const changeMode = async (pageId: string, mode: WorkspaceMode): Promise<void> =>
    transition(() => {
      const currentMode =
        useWorkspaceStore.getState().openPages.find((tab) => tab.id === pageId)?.mode ?? 'chat';
      if (mode === 'edit' && currentMode !== 'edit') {
        collapseSidebar();
        // Entering edit mode does not leave the pointer over the collapse button.
        setSidebarPeekEnabled(true);
      }
      if (mode === 'chat') {
        pinSidebarOpen();
      }
      useWorkspaceStore.getState().setPageMode(pageId, mode);
    });

  const openPreview = async (pageId: string): Promise<void> => {
    await editorRefs.get(pageId)?.current?.flush();
    useWorkspaceStore.getState().setPageMode(pageId, 'preview');
  };

  const selectPage = (pageId: string): void => {
    if (!editorRefs.has(pageId)) editorRefs.set(pageId, { current: null });
    setMountedPageIds((current) => (current.includes(pageId) ? current : [...current, pageId]));
    selectWorkspacePage(pageId);
    setSidebarPeek(false);
  };

  const closePage = (pageId: string): void => {
    closeWorkspacePage(pageId);
    setMountedPageIds((current) => current.filter((id) => id !== pageId));
    editorRefs.delete(pageId);
  };

  useEffect(() => {
    let active = true;
    projectsService
      .list()
      .then(async (projectRecords) => {
        const hydrated = await Promise.all(
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
        if (!active) return;
        restoreWorkspace(hydrated);
      })
      .catch((error: unknown) => {
        if (!active) return;
        failWorkspaceRestore(error instanceof Error ? error.message : '无法恢复工作区');
      });
    return () => {
      active = false;
    };
  }, [failWorkspaceRestore, restoreWorkspace]);

  const collapseSidebar = (): void => {
    setSidebarCollapsed(true);
    setSidebarPeek(false);
    setSidebarPeekEnabled(false);
  };

  const pinSidebarOpen = (): void => {
    setSidebarCollapsed(false);
    setSidebarPeek(false);
    setSidebarPeekEnabled(true);
  };

  const addPage = (projectId: string, page: PageItem): void => {
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId ? { ...project, pages: [...project.pages, page] } : project,
      ),
    );
    void transition(() => selectPage(page.id));
  };
  const sidebar = (
    <Sidebar
      isMacDesktop={macDesktop}
      onPin={pinSidebarOpen}
      onTemporaryClose={() => setSidebarPeek(false)}
      onOpenSettings={openSettings}
      flushEditor={flushEditor}
      onPageCreated={addPage}
      onSelectPage={(pageId) => void transition(() => selectPage(pageId))}
    />
  );
  return (
    <TooltipProvider>
      <main
        className='flex h-full w-full overflow-hidden bg-white text-[13px] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100'
        data-theme={theme}
      >
        {sidebarVisible && sidebar}
        {transitionError && (
          <div
            role='alert'
            className='fixed bottom-4 left-1/2 z-50 rounded-lg bg-danger p-3 text-danger-foreground'
          >
            操作未完成：{transitionError}。编辑内容已保留，请重试。
          </div>
        )}
        <button
          type='button'
          className={`window-no-drag-region fixed top-1.5 z-30 h-7 min-h-7 w-7 min-w-7 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${
            macDesktop ? 'left-21' : 'left-1.5'
          } grid cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-primary`}
          onMouseEnter={() => sidebarCollapsed && sidebarPeekEnabled && setSidebarPeek(true)}
          onMouseLeave={() => sidebarCollapsed && setSidebarPeekEnabled(true)}
          onClick={sidebarCollapsed ? pinSidebarOpen : collapseSidebar}
          aria-expanded={sidebarPeek}
          aria-controls='project-sidebar'
          aria-label={
            sidebarCollapsed ? (sidebarPeek ? '固定展开侧边栏' : '展开侧边栏') : '收起侧边栏'
          }
        >
          {sidebarCollapsed ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
        </button>

        {!workspaceReady ? (
          <section
            className='flex min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-white text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400'
            aria-busy={!workspaceError}
            aria-label='恢复工作区'
          >
            {workspaceError ? (
              <>
                <p role='alert'>工作区恢复失败：{workspaceError}</p>
                <Button variant='secondary' onClick={() => window.location.reload()}>
                  重新加载
                </Button>
              </>
            ) : (
              <>
                <Spinner aria-label='正在恢复工作区' />
                <p role='status'>正在恢复工作区…</p>
              </>
            )}
          </section>
        ) : (
          <section className='flex min-w-0 flex-1 flex-col'>
            {openPages.length > 0 && (
              <PageTabs
                sidebarCollapsed={sidebarCollapsed}
                isMacDesktop={macDesktop}
                onSelect={(pageId) => void transition(() => selectPage(pageId))}
                onClose={(pageId) => void transition(() => closePage(pageId))}
              />
            )}
            {openPages.length === 0 && (
              <div
                aria-hidden='true'
                className='flex h-10 shrink-0 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900'
              >
                {sidebarCollapsed && macDesktop && (
                  <span className='window-no-drag-region w-32 shrink-0' />
                )}
                <span className='window-drag-region min-w-0 flex-1' />
              </div>
            )}
            <div className='relative flex min-h-0 flex-1'>
              {mountedPages.map(({ pageId }) => {
                const active = pageId === selectedPageId;
                return (
                  <div
                    key={pageId}
                    className={`absolute inset-0 flex min-h-0 ${active ? 'visible' : 'invisible pointer-events-none'}`}
                    aria-hidden={!active}
                    inert={active ? undefined : true}
                  >
                    <Workspace
                      active={active}
                      pageId={pageId}
                      editorRef={editorRefForPage(pageId)}
                      onModeChange={(mode) => changeMode(pageId, mode)}
                      onPreview={() => openPreview(pageId)}
                      onConfigureModel={openModelSettings}
                      schemaRefreshKey={schemaRefreshKeys[pageId] ?? ''}
                      onSchemaCommitted={(committedPageId, revisionId) => {
                        setSchemaRefreshKeys((current) => ({
                          ...current,
                          [committedPageId]: revisionId,
                        }));
                      }}
                    />
                  </div>
                );
              })}
              {mountedPages.length === 0 && (
                <EmptyWorkspace onCreateProject={() => setIsHomeProjectModalOpen(true)} />
              )}
            </div>
          </section>
        )}

        <SettingsModal
          isOpen={isSettingsOpen}
          initialSection={settingsSection}
          onClose={closeSettings}
        />

        <CreateProjectModal
          isOpen={isHomeProjectModalOpen}
          onClose={() => setIsHomeProjectModalOpen(false)}
        />
      </main>
    </TooltipProvider>
  );
};

export default App;
