import { Button, Spinner } from '@heroui/react';
import { PanelLeft } from 'lucide-react';
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

function App(): React.JSX.Element {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [openPageIds, setOpenPageIds] = useState<string[]>([]);
  const [pageModes, setPageModes] = useState<Record<string, WorkspaceMode>>({});
  const {
    activeTab,
    setActiveTab,
    isSettingsOpen,
    setIsSettingsOpen,
    sidebarCollapsed: sessionSidebarCollapsed,
    setSidebarCollapsed,
    restoreSidebarCollapsed,
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
  const transitionPending = useRef(false);
  const previousPreviewMode = useRef<Record<string, Exclude<WorkspaceMode, 'preview'>>>({});
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const selectedPage = projects
    .flatMap((project) => project.pages)
    .find((page) => page.id === selectedPageId);
  const selectedProject = projects.find((project) =>
    project.pages.some((page) => page.id === selectedPageId),
  );
  const sidebarVisible = !sidebarCollapsed || sidebarPeek;

  const flushEditor = async (): Promise<void> => {
    await editorRef.current?.flush();
  };
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
  const transition = async (action: () => void | Promise<void>): Promise<void> => {
    if (transitionPending.current) return;
    transitionPending.current = true;
    setTransitionError(null);
    try {
      await flushEditor();
      await action();
    } catch (error) {
      setTransitionError(error instanceof Error ? error.message : '保存失败，请重试');
    } finally {
      transitionPending.current = false;
    }
  };
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
        setPageModes((current) => ({ ...current, [selectedPageId]: mode }));
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
    setPageModes((current) => ({ ...current, [selectedPage.id]: 'preview' }));
    setActiveTab('preview');
  };

  const selectPage = (pageId: string): void => {
    if (selectedPageId && activeTab !== 'preview') {
      setPageModes((current) => ({ ...current, [selectedPageId]: activeTab }));
    }
    setOpenPageIds((current) => (current.includes(pageId) ? current : [...current, pageId]));
    setSelectedPageId(pageId);
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
    setOpenPageIds(remaining);
    setPageModes((current) => {
      const next = { ...current };
      delete next[pageId];
      return next;
    });
    delete previousPreviewMode.current[pageId];
    if (selectedPageId === pageId) {
      const nextId = remaining[Math.min(index, remaining.length - 1)] ?? null;
      setSelectedPageId(nextId);
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
        setProjects(hydrated);
        // A fresh workbench starts empty. Pages become tabs only after an explicit selection.
        setSelectedPageId(null);
        setOpenPageIds([]);
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
  }, [restoreSidebarCollapsed]);

  useEffect(() => {
    if (!workspaceReady) return;
    const activeProjectId = projects.find((project) =>
      project.pages.some((page) => page.id === selectedPageId),
    )?.id;
    const workspace = {
      activeProjectId: activeProjectId ?? null,
      activePageId: selectedPageId,
      theme,
      sidebarCollapsed,
    };
    void workspaceService.save(workspace);
  }, [projects, selectedPageId, theme, sidebarCollapsed, workspaceReady]);

  useEffect(() => {
    window.api?.settings
      ?.getProfile?.()
      .then(setUserProfile)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    return window.api?.window?.onPreviewExited?.((target) => {
      const restored = previousPreviewMode.current[target.pageId] ?? 'chat';
      setPageModes((current) => ({ ...current, [target.pageId]: restored }));
      if (selectedPageId === target.pageId) setActiveTab(restored);
    });
  }, [selectedPageId, setActiveTab]);

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

  const openProject = async (): Promise<void> => {
    await flushEditor();
    const grant = await window.api?.dialog?.chooseExistingProject?.();
    if (!grant) return;
    const project = await projectsService.open({ directoryGrantId: grant.directoryGrantId });
    const pages = await projectsService.pages(project.id);
    const result = {
      project: {
        id: project.id,
        name: project.name,
        path: project.path,
        pages: pages.map((page) => ({ id: page.id, name: page.name, fileName: page.slug })),
      },
    };
    setProjects((current) => [
      ...current.filter((project) => project.path !== result.project.path),
      result.project,
    ]);
    setSelectedPageId(result.project.pages[0]?.id ?? null);
    setOpenPageIds(result.project.pages[0] ? [result.project.pages[0].id] : []);
    setActiveTab('chat');
  };

  const sidebar = (
    <Sidebar
      projects={projects}
      selectedPageId={selectedPageId}
      isTemporary={sidebarCollapsed}
      userProfile={userProfile}
      onCollapse={collapseSidebar}
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
        void openProject().catch((error: unknown) =>
          setTransitionError(error instanceof Error ? error.message : '打开失败'),
        )
      }
      onPageCreated={addPage}
      onSelectPage={(pageId) =>
        void transition(() => {
          selectPage(pageId);
        })
      }
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
      {sidebarCollapsed && (
        <Button
          isIconOnly
          size='sm'
          variant='ghost'
          className='fixed top-1.5 left-1.5 z-30 h-7 min-h-7 w-7 min-w-7 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
          onMouseEnter={() => sidebarPeekEnabled && setSidebarPeek(true)}
          onMouseLeave={() => setSidebarPeekEnabled(true)}
          onPress={pinSidebarOpen}
          aria-expanded={sidebarPeek}
          aria-controls='project-sidebar'
          aria-label='展开侧边栏'
        >
          <PanelLeft size={17} />
        </Button>
      )}

      {isSettingsOpen ? (
        <SettingsPage
          theme={theme}
          sidebarCollapsed={sidebarCollapsed}
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
              onSelect={(pageId) => void transition(() => selectPage(pageId))}
              onClose={(pageId) => void transition(() => closePage(pageId))}
            />
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
    </main>
  );
}

export default App;
