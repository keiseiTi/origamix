import { Button, Modal, Spinner } from '@heroui/react';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Sidebar,
  type AppTheme,
  type PageItem,
  type ProjectItem,
  type UserProfile,
} from './components/sidebar';
import { CreateProjectModal } from './components/sidebar/mod/create-project-modal';
import { SettingsPage } from './components/settings-page';
import { Workspace } from './components/workspace';
import { PageTabs } from './components/workspace/page-tabs';
import type { EditorHandle } from './components/editor';
import type { WorkspaceMode } from './components/workspace';
import { useViewSession } from './store/use-view-session';
import { projectsService } from './services/projects';
import { workspaceService } from './services/workspace';
import { schemaService } from './services/schema';
import { useWorkspaceTransitions } from './hooks/use-workspace-transitions';
import { useProjectActions } from './hooks/use-project-actions';

function App(): React.JSX.Element {
  const isMacDesktop = window.api?.platform === 'darwin';
  const supportsNativeProjectDirectories = Boolean(window.api?.dialog);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const {
    activeTab,
    setActiveTab,
    isSettingsOpen,
    setIsSettingsOpen,
    sidebarCollapsed: sessionSidebarCollapsed,
    setSidebarCollapsed,
    restoreSidebarCollapsed,
    activeProjectId,
    activePageId: selectedPageId,
    openPageIds,
    pageModes,
    pageDrafts,
    updateWorkspace,
  } = useViewSession();
  const sidebarCollapsed = sessionSidebarCollapsed ?? false;
  const [sidebarPeek, setSidebarPeek] = useState(false);
  const [sidebarPeekEnabled, setSidebarPeekEnabled] = useState(true);
  const [theme, setTheme] = useState<AppTheme>('light');
  const [isHomeProjectModalOpen, setIsHomeProjectModalOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Origamix 用户',
    iconBackground: '#2563eb',
  });
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const editorRef = useRef<EditorHandle>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const previousPreviewMode = useRef<Record<string, Exclude<WorkspaceMode, 'preview'>>>({});
  const initialWorkspaceSession = useRef({
    activeProjectId,
    selectedPageId,
    openPageIds,
    pageModes,
    pageDrafts,
  });
  const [schemaRefreshKeys, setSchemaRefreshKeys] = useState<Record<string, string>>({});
  const selectedPage = projects
    .flatMap((project) => project.pages)
    .find((page) => page.id === selectedPageId);
  const selectedProject = projects.find((project) =>
    project.pages.some((page) => page.id === selectedPageId),
  );
  const sidebarVisible = !sidebarCollapsed || sidebarPeek;

  const flushEditor = useCallback(async (): Promise<void> => {
    await editorRef.current?.flush();
  }, []);
  const { transition, transitionError, setTransitionError } = useWorkspaceTransitions(flushEditor);
  const syncPreviewBounds = useCallback(async (): Promise<void> => {
    const element = workspaceRef.current;
    if (!element || !window.api?.window?.setPreviewBounds) return;
    const bounds = element.getBoundingClientRect();
    await window.api.window.setPreviewBounds({
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: Math.max(1, Math.round(bounds.width)),
      height: Math.max(1, Math.round(bounds.height)),
    });
  }, []);
  const changeMode = async (mode: WorkspaceMode): Promise<void> =>
    transition(() => {
      if (mode === 'edit' && activeTab !== 'edit') {
        collapseSidebar();
        // Entering edit mode does not leave the pointer over the collapse button.
        setSidebarPeekEnabled(true);
      }
      if (mode === 'chat') {
        pinSidebarOpen();
      }
      setActiveTab(mode);
      if (selectedPageId) {
        updateWorkspace({ pageModes: { ...pageModes, [selectedPageId]: mode } });
      }
    });

  const openPreview = async (): Promise<void> => {
    if (!selectedProject || !selectedPage) throw new Error('请先选择需要预览的页面');
    if (!window.api?.window?.openPage) throw new Error('应用级预览仅在桌面端可用');
    await flushEditor();
    await syncPreviewBounds();
    await window.api.window.openPage({
      projectId: selectedProject.id,
      pageId: selectedPage.id,
      mode: 'preview',
    });
    previousPreviewMode.current[selectedPage.id] =
      activeTab === 'preview'
        ? (previousPreviewMode.current[selectedPage.id] ?? 'chat')
        : activeTab;
    updateWorkspace({ pageModes: { ...pageModes, [selectedPage.id]: 'preview' } });
    setActiveTab('preview');
  };

  const undoPage = async (): Promise<void> => {
    if (!selectedProject || !selectedPage) throw new Error('请先选择需要撤销的页面');
    await flushEditor();
    const result = await schemaService.undo(selectedProject.id, selectedPage.id);
    setSchemaRefreshKeys((current) => ({ ...current, [selectedPage.id]: result.revisionId }));
  };

  const selectPage = (pageId: string): void => {
    const nextModes =
      selectedPageId && activeTab !== 'preview'
        ? { ...pageModes, [selectedPageId]: activeTab }
        : { ...pageModes };
    const projectId = projects.find((project) =>
      project.pages.some((page) => page.id === pageId),
    )?.id;
    updateWorkspace({
      activeProjectId: projectId ?? activeProjectId,
      activePageId: pageId,
      openPageIds: openPageIds.includes(pageId) ? openPageIds : [...openPageIds, pageId],
      pageModes: nextModes,
    });
    setActiveTab(pageModes[pageId] === 'edit' ? 'edit' : 'chat');
    setSidebarPeek(false);
  };

  const closePage = async (pageId: string): Promise<void> => {
    if (pageModes[pageId] === 'preview') {
      const project = projects.find((item) => item.pages.some((page) => page.id === pageId));
      if (project && window.api?.window?.closePreview) {
        await window.api.window.closePreview({ projectId: project.id, pageId, mode: 'preview' });
      }
    }
    const index = openPageIds.indexOf(pageId);
    const remaining = openPageIds.filter((id) => id !== pageId);
    const nextModes = { ...pageModes };
    const nextDrafts = { ...pageDrafts };
    delete nextModes[pageId];
    delete nextDrafts[pageId];
    delete previousPreviewMode.current[pageId];
    const nextId =
      selectedPageId === pageId
        ? (remaining[Math.min(index, remaining.length - 1)] ?? null)
        : selectedPageId;
    const nextProjectId =
      projects.find((project) => project.pages.some((page) => page.id === nextId))?.id ??
      activeProjectId;
    updateWorkspace({
      activeProjectId: nextProjectId,
      activePageId: nextId,
      openPageIds: remaining,
      pageModes: nextModes,
      pageDrafts: nextDrafts,
    });
    if (selectedPageId === pageId) {
      setActiveTab(nextId && pageModes[nextId] === 'edit' ? 'edit' : 'chat');
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    let active = true;
    Promise.all([workspaceService.get(), projectsService.list()])
      .then(async ([workspace, projectRecords]) => {
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
        const session = initialWorkspaceSession.current;
        setProjects(hydrated);
        const pageIds = new Set(
          hydrated.flatMap((project) => project.pages.map((page) => page.id)),
        );
        const projectIds = new Set(hydrated.map((project) => project.id));
        const restoredOpenIds = session.openPageIds.filter((id) => pageIds.has(id));
        const restoredPageId =
          session.selectedPageId && pageIds.has(session.selectedPageId)
            ? session.selectedPageId
            : null;
        const nextOpenIds =
          restoredPageId && !restoredOpenIds.includes(restoredPageId)
            ? [...restoredOpenIds, restoredPageId]
            : restoredOpenIds;
        const nextModes = Object.fromEntries(
          Object.entries(session.pageModes).filter(([id]) => pageIds.has(id)),
        );
        const nextDrafts = Object.fromEntries(
          Object.entries(session.pageDrafts).filter(([id]) => pageIds.has(id)),
        );
        const restoredPageProjectId = hydrated.find((project) =>
          project.pages.some((page) => page.id === restoredPageId),
        )?.id;
        const restoredProjectId =
          restoredPageProjectId ??
          (session.activeProjectId && projectIds.has(session.activeProjectId)
            ? session.activeProjectId
            : null);
        updateWorkspace({
          activeProjectId: restoredProjectId,
          activePageId: restoredPageId,
          openPageIds: nextOpenIds,
          pageModes: nextModes,
          pageDrafts: nextDrafts,
          activeTab: restoredPageId && nextModes[restoredPageId] === 'edit' ? 'edit' : 'chat',
        });
        setTheme(workspace.theme);
        restoreSidebarCollapsed(workspace.sidebarCollapsed);
        setWorkspaceReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setWorkspaceError(error instanceof Error ? error.message : '无法恢复工作区');
      });
    return () => {
      active = false;
    };
  }, [restoreSidebarCollapsed, updateWorkspace]);

  useEffect(() => {
    if (!workspaceReady) return;
    const workspace = {
      theme,
      sidebarCollapsed,
    };
    void workspaceService.save(workspace);
  }, [theme, sidebarCollapsed, workspaceReady]);

  useEffect(() => {
    window.api?.settings
      ?.getProfile?.()
      .then(setUserProfile)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    return window.api?.window?.onPreviewExited?.((target) => {
      const restored = previousPreviewMode.current[target.pageId] ?? 'chat';
      updateWorkspace({ pageModes: { ...pageModes, [target.pageId]: restored } });
      if (selectedPageId === target.pageId) setActiveTab(restored);
    });
  }, [pageModes, selectedPageId, setActiveTab, updateWorkspace]);

  useEffect(() => {
    const element = workspaceRef.current;
    if (activeTab !== 'preview' || !element) return;
    const observer = new ResizeObserver(() => void syncPreviewBounds());
    observer.observe(element);
    void syncPreviewBounds();
    return () => observer.disconnect();
  }, [activeTab, sidebarCollapsed, syncPreviewBounds]);

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
    void transition(() => {
      selectPage(page.id);
    });
  };
  const projectActions = useProjectActions({
    projects,
    setProjects,
    selectedPageId,
    openPageIds,
    pageModes,
    pageDrafts,
    updateWorkspace,
    setActiveTab,
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
      onOpenSettings={() =>
        void transition(() => {
          setSidebarPeek(false);
          setIsSettingsOpen(true);
        })
      }
      onProjectCreated={(project) => setProjects((current) => [...current, project])}
      onOpenProject={() =>
        void projectActions
          .openProject()
          .catch((error: unknown) =>
            setTransitionError(error instanceof Error ? error.message : '打开失败'),
          )
      }
      onPageCreated={addPage}
      onRenameProject={projectActions.renameProject}
      onDeleteProject={projectActions.deleteProject}
      onRenamePage={projectActions.renamePage}
      onDeletePage={projectActions.deletePage}
      onDuplicatePage={projectActions.duplicatePage}
      onSelectPage={(pageId) =>
        void transition(() => {
          selectPage(pageId);
        })
      }
      supportsNativeProjectDirectories={supportsNativeProjectDirectories}
    />
  );
  return (
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
          isMacDesktop ? 'left-[76px]' : 'left-1.5'
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

      {isSettingsOpen ? (
        <SettingsPage
          theme={theme}
          sidebarCollapsed={sidebarCollapsed}
          isMacDesktop={isMacDesktop}
          userProfile={userProfile}
          onThemeChange={setTheme}
          onProfileChange={setUserProfile}
          onBack={() => setIsSettingsOpen(false)}
        />
      ) : !workspaceReady ? (
        <section
          className='flex min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-white text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400'
          aria-busy={!workspaceError}
          aria-label='恢复工作区'
        >
          {workspaceError ? (
            <>
              <p role='alert'>工作区恢复失败：{workspaceError}</p>
              <Button variant='secondary' onPress={() => window.location.reload()}>
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
                <span className='window-no-drag-region w-[108px] shrink-0' />
              )}
              <span className='window-drag-region min-w-0 flex-1' />
            </div>
          )}
          <div ref={workspaceRef} className='flex min-h-0 flex-1'>
            <Workspace
              page={selectedPage}
              projectId={selectedProject?.id}
              projectName={selectedProject?.name}
              mode={activeTab}
              editorRef={editorRef}
              onModeChange={changeMode}
              onPreview={openPreview}
              onUndo={undoPage}
              draft={selectedPageId ? (pageDrafts[selectedPageId] ?? '') : ''}
              onDraftChange={(draft) => {
                if (selectedPageId) {
                  updateWorkspace({ pageDrafts: { ...pageDrafts, [selectedPageId]: draft } });
                }
              }}
              supportsNativeProjectDirectories={supportsNativeProjectDirectories}
              schemaRefreshKey={selectedPageId ? (schemaRefreshKeys[selectedPageId] ?? '') : ''}
              onSchemaCommitted={(pageId, revisionId) => {
                setSchemaRefreshKeys((current) => ({ ...current, [pageId]: revisionId }));
              }}
              onCreateProject={() => setIsHomeProjectModalOpen(true)}
            />
          </div>
        </section>
      )}

      <CreateProjectModal
        isOpen={isHomeProjectModalOpen}
        onClose={() => setIsHomeProjectModalOpen(false)}
        onCreated={(project) => setProjects((current) => [...current, project])}
      />
      <Modal
        isOpen={projectActions.pendingInitialization !== null}
        onOpenChange={(open) => !open && projectActions.setPendingInitialization(null)}
      >
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>初始化项目</Modal.Heading>
              </Modal.Header>
              <Modal.Body className='grid gap-3'>
                <p className='text-sm text-zinc-700 dark:text-zinc-300'>
                  选择的目录尚未初始化为 Origamix 项目。是否在该目录中建立项目索引？
                </p>
                <p className='break-all text-xs text-zinc-400 dark:text-zinc-500'>
                  {projectActions.pendingInitialization?.displayPath}
                </p>
                <p className='text-xs text-zinc-400 dark:text-zinc-500'>
                  将写入 Origamix 项目清单和页面 registry，不会删除目录中的现有文件。
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant='tertiary'
                  onPress={() => projectActions.setPendingInitialization(null)}
                >
                  取消
                </Button>
                <Button
                  isDisabled={projectActions.initializing}
                  onPress={() => void projectActions.initializePendingProject()}
                >
                  {projectActions.initializing ? '初始化中…' : '初始化并打开'}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </main>
  );
}

export default App;
