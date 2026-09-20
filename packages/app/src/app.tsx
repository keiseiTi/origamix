import { Button } from './components/ui/button';
import { Spinner } from './components/ui/spinner';
import { TooltipProvider } from './components/ui/tooltip';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Sidebar } from './components/sidebar';
import { CreateProjectModal } from './components/sidebar/mod/create-project-modal';
import { SettingsModal } from './components/settings';
import { Workspace } from './components/workspace';
import { PageTabs } from './components/workspace/page-tabs';
import type { EditorHandle } from './components/editor';
import type { WorkspaceMode } from './components/workspace';
import { projectsService } from './services/projects';
import { useWorkspaceTransitions } from './hooks/use-workspace-transitions';
import { useProjectActions } from './hooks/use-project-actions';
import { usePreferencesStore } from './store/preferences';
import { useWorkspaceStore, type PageItem } from './store/workspace';

const App = (): React.JSX.Element => {
  const isMacDesktop = window.api?.platform === 'darwin';
  const supportsNativeProjectDirectories = Boolean(window.api?.dialog);
  const projects = useWorkspaceStore((state) => state.projects);
  const setProjects = useWorkspaceStore((state) => state.setProjects);
  const sessionSidebarCollapsed = useWorkspaceStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useWorkspaceStore((state) => state.setSidebarCollapsed);
  const selectedPageId = useWorkspaceStore((state) => state.activePageId);
  const openPageIds = useWorkspaceStore((state) => state.openPageIds);
  const pageModes = useWorkspaceStore((state) => state.pageModes);
  const pageDrafts = useWorkspaceStore((state) => state.pageDrafts);
  const selectWorkspacePage = useWorkspaceStore((state) => state.selectPage);
  const closeWorkspacePage = useWorkspaceStore((state) => state.closePage);
  const setPageMode = useWorkspaceStore((state) => state.setPageMode);
  const setPageDraft = useWorkspaceStore((state) => state.setPageDraft);
  const restoreWorkspace = useWorkspaceStore((state) => state.restoreWorkspace);
  const failWorkspaceRestore = useWorkspaceStore((state) => state.failWorkspaceRestore);
  const workspaceReady = useWorkspaceStore((state) => state.workspaceReady);
  const workspaceError = useWorkspaceStore((state) => state.workspaceError);
  const sidebarCollapsed = sessionSidebarCollapsed ?? false;
  const [sidebarPeek, setSidebarPeek] = useState(false);
  const [sidebarPeekEnabled, setSidebarPeekEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'general' | 'model'>('general');
  const [hasModelApiKey, setHasModelApiKey] = useState<boolean | undefined>(undefined);
  const theme = usePreferencesStore((state) => state.theme);
  const setTheme = usePreferencesStore((state) => state.setTheme);
  const [isHomeProjectModalOpen, setIsHomeProjectModalOpen] = useState(false);
  const userProfile = usePreferencesStore((state) => state.userProfile);
  const setUserProfile = usePreferencesStore((state) => state.setUserProfile);
  const [editorRefs] = useState(() => {
    const refs = new Map<string, { current: EditorHandle | null }>();
    const initialPageId = useWorkspaceStore.getState().activePageId;
    if (initialPageId) refs.set(initialPageId, { current: null });
    return refs;
  });
  const emptyEditorRef = useRef<EditorHandle>(null);
  const [schemaRefreshKeys, setSchemaRefreshKeys] = useState<Record<string, string>>({});
  const [mountedPageIds, setMountedPageIds] = useState<string[]>(() => {
    const initialPageId = useWorkspaceStore.getState().activePageId;
    return initialPageId ? [initialPageId] : [];
  });
  const sidebarVisible = !sidebarCollapsed || sidebarPeek;
  const mountedPages = mountedPageIds.flatMap((pageId) => {
    const project = projects.find((item) => item.pages.some((page) => page.id === pageId));
    const page = project?.pages.find((item) => item.id === pageId);
    return project && page ? [{ pageId, project, page }] : [];
  });

  const editorRefForPage = (pageId: string): { current: EditorHandle | null } => {
    const existing = editorRefs.get(pageId);
    if (!existing) throw new Error(`页面 ${pageId} 尚未初始化编辑器引用`);
    return existing;
  };

  const openSettings = (): void => {
    setSidebarPeek(false);
    setSettingsSection('general');
    setIsSettingsOpen(true);
  };

  const openModelSettings = (): void => {
    setSidebarPeek(false);
    setSettingsSection('model');
    setIsSettingsOpen(true);
  };

  const closeSettings = (): void => {
    setIsSettingsOpen(false);
  };

  const flushEditor = useCallback(async (): Promise<void> => {
    if (!selectedPageId) return;
    await editorRefs.get(selectedPageId)?.current?.flush();
  }, [editorRefs, selectedPageId]);
  const { transition, transitionError, setTransitionError } = useWorkspaceTransitions(flushEditor);
  const changeMode = async (pageId: string, mode: WorkspaceMode): Promise<void> =>
    transition(() => {
      const currentMode = pageModes[pageId] ?? 'chat';
      if (mode === 'edit' && currentMode !== 'edit') {
        collapseSidebar();
        // Entering edit mode does not leave the pointer over the collapse button.
        setSidebarPeekEnabled(true);
      }
      if (mode === 'chat') {
        pinSidebarOpen();
      }
      setPageMode(pageId, mode);
    });

  const openPreview = async (pageId: string): Promise<void> => {
    await editorRefs.get(pageId)?.current?.flush();
    setPageMode(pageId, 'preview');
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
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

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

  useEffect(() => {
    window.api?.settings
      ?.getProfile?.()
      .then(setUserProfile)
      .catch(() => undefined);
  }, [setUserProfile]);

  useEffect(() => {
    window.api?.settings
      ?.getModel?.()
      .then((settings) => setHasModelApiKey(settings.hasApiKey))
      .catch(() => setHasModelApiKey(undefined));
  }, []);

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
  const projectActions = useProjectActions({
    flushEditor,
    onPageAdded: addPage,
    onError: setTransitionError,
  });

  const sidebar = (
    <Sidebar
      projects={projects}
      selectedPageId={selectedPageId}
      isTemporary={sidebarCollapsed}
      isMacDesktop={isMacDesktop}
      userProfile={userProfile}
      onPin={pinSidebarOpen}
      onTemporaryClose={() => setSidebarPeek(false)}
      onOpenSettings={openSettings}
      onProjectCreated={(project) => setProjects((current) => [...current, project])}
      pendingProjectInitialization={projectActions.pendingInitialization}
      projectInitializing={projectActions.initializing}
      onOpenProject={projectActions.openProject}
      onCancelProjectInitialization={() => projectActions.setPendingInitialization(null)}
      onInitializeProject={projectActions.initializePendingProject}
      onPageCreated={addPage}
      onRenameProject={projectActions.renameProject}
      onDeleteProject={projectActions.deleteProject}
      onRenamePage={projectActions.renamePage}
      onDeletePage={projectActions.deletePage}
      onSelectPage={(pageId) => void transition(() => selectPage(pageId))}
      supportsNativeProjectDirectories={supportsNativeProjectDirectories}
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
            isMacDesktop ? 'left-21' : 'left-1.5'
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
            {openPageIds.length > 0 && (
              <PageTabs
                pages={openPageIds.flatMap((pageId) => {
                  const page = projects
                    .flatMap((project) => project.pages)
                    .find((item) => item.id === pageId);
                  return page ? [page] : [];
                })}
                activePageId={selectedPageId}
                sidebarCollapsed={sidebarCollapsed}
                isMacDesktop={isMacDesktop}
                onSelect={(pageId) => void transition(() => selectPage(pageId))}
                onClose={(pageId) => void transition(() => closePage(pageId))}
              />
            )}
            {openPageIds.length === 0 && (
              <div
                aria-hidden='true'
                className='flex h-10 shrink-0 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900'
              >
                {sidebarCollapsed && isMacDesktop && (
                  <span className='window-no-drag-region w-32 shrink-0' />
                )}
                <span className='window-drag-region min-w-0 flex-1' />
              </div>
            )}
            <div className='relative flex min-h-0 flex-1'>
              {mountedPages.map(({ pageId, project, page }) => {
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
                      page={page}
                      projectId={project.id}
                      projectName={project.name}
                      mode={pageModes[pageId] ?? 'chat'}
                      theme={theme}
                      editorRef={editorRefForPage(pageId)}
                      onModeChange={(mode) => changeMode(pageId, mode)}
                      onPreview={() => openPreview(pageId)}
                      draft={pageDrafts[pageId] ?? ''}
                      onDraftChange={(draft) => setPageDraft(pageId, draft)}
                      hasModelApiKey={hasModelApiKey}
                      onConfigureModel={openModelSettings}
                      supportsNativeProjectDirectories={supportsNativeProjectDirectories}
                      schemaRefreshKey={schemaRefreshKeys[pageId] ?? ''}
                      onSchemaCommitted={(committedPageId, revisionId) => {
                        setSchemaRefreshKeys((current) => ({
                          ...current,
                          [committedPageId]: revisionId,
                        }));
                      }}
                      onCreateProject={() => setIsHomeProjectModalOpen(true)}
                    />
                  </div>
                );
              })}
              {mountedPages.length === 0 && (
                <Workspace
                  mode='chat'
                  theme={theme}
                  editorRef={emptyEditorRef}
                  onModeChange={async () => undefined}
                  onPreview={async () => undefined}
                  draft=''
                  onDraftChange={() => undefined}
                  supportsNativeProjectDirectories={supportsNativeProjectDirectories}
                  schemaRefreshKey=''
                  onSchemaCommitted={() => undefined}
                  onCreateProject={() => setIsHomeProjectModalOpen(true)}
                />
              )}
            </div>
          </section>
        )}

        <SettingsModal
          isOpen={isSettingsOpen}
          initialSection={settingsSection}
          theme={theme}
          userProfile={userProfile}
          onThemeChange={setTheme}
          onProfileChange={setUserProfile}
          onModelConfiguredChange={setHasModelApiKey}
          onClose={closeSettings}
        />

        <CreateProjectModal
          isOpen={isHomeProjectModalOpen}
          onClose={() => setIsHomeProjectModalOpen(false)}
          onCreated={(project) => setProjects((current) => [...current, project])}
        />
      </main>
    </TooltipProvider>
  );
};

export default App;
