import { Button } from '@heroui/react';
import { PanelLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  Sidebar,
  type AppTheme,
  type PageItem,
  type ProjectItem,
  type UserProfile
} from './components/sidebar';
import { CreateProjectModal } from './components/sidebar/mod/create-project-modal';
import { SettingsPage } from './components/settings-page';
import { Workspace, type WorkspaceMode } from './components/workspace';
import { backendApi } from './services/backend-api';

function App(): React.JSX.Element {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceMode>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPeek, setSidebarPeek] = useState(false);
  const [sidebarPeekEnabled, setSidebarPeekEnabled] = useState(true);
  const [theme, setTheme] = useState<AppTheme>('light');
  const [isHomeProjectModalOpen, setIsHomeProjectModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Origamix 用户',
    iconBackground: '#2563eb'
  });
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const selectedPage = projects
    .flatMap((project) => project.pages)
    .find((page) => page.id === selectedPageId);
  const selectedProject = projects.find((project) =>
    project.pages.some((page) => page.id === selectedPageId)
  );
  const sidebarVisible = !sidebarCollapsed || sidebarPeek;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    Promise.all([backendApi.workspace.get(), backendApi.projects.list()])
      .then(async ([workspace, projectRecords]) => {
        const hydrated = await Promise.all(
          projectRecords.map(async (project) => ({
            id: project.id,
            name: project.name,
            path: project.path,
            pages: (await backendApi.projects.pages(project.id)).map((page) => ({
              id: page.id,
              name: page.name,
              fileName: page.slug
            }))
          }))
        );
        setProjects(hydrated);
        setSelectedPageId(workspace.activePageId);
        setTheme(workspace.theme);
        setSidebarCollapsed(workspace.sidebarCollapsed);
      })
      .catch(() => undefined)
      .finally(() => setWorkspaceReady(true));
  }, []);

  useEffect(() => {
    if (!workspaceReady) return;
    const activeProjectId = projects.find((project) =>
      project.pages.some((page) => page.id === selectedPageId)
    )?.id;
    const workspace = {
      activeProjectId: activeProjectId ?? null,
      activePageId: selectedPageId,
      theme,
      sidebarCollapsed
    };
    void backendApi.workspace.save(workspace);
  }, [projects, selectedPageId, theme, sidebarCollapsed, workspaceReady]);

  useEffect(() => {
    window.api.settings
      .getProfile()
      .then(setUserProfile)
      .catch(() => undefined);
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
        project.id === projectId ? { ...project, pages: [...project.pages, page] } : project
      )
    );
    setSelectedPageId(page.id);
  };

  const openProject = async (): Promise<void> => {
    const grant = await window.api.dialog.chooseExistingProject();
    if (!grant) return;
    const project = await backendApi.projects.open({ directoryGrantId: grant.directoryGrantId });
    const pages = await backendApi.projects.pages(project.id);
    const result = {
      project: {
        id: project.id,
        name: project.name,
        path: project.path,
        pages: pages.map((page) => ({ id: page.id, name: page.name, fileName: page.slug }))
      }
    };
    setProjects((current) => [
      ...current.filter((project) => project.path !== result.project.path),
      result.project
    ]);
    setSelectedPageId(result.project.pages[0]?.id ?? null);
    setActiveTab('chat');
  };

  return (
    <main
      className="flex h-full w-full overflow-hidden bg-white text-[13px] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
      data-theme={theme}
    >
      {sidebarVisible && (
        <Sidebar
          projects={projects}
          selectedPageId={selectedPageId}
          isTemporary={sidebarCollapsed}
          userProfile={userProfile}
          onCollapse={collapseSidebar}
          onPin={pinSidebarOpen}
          onTemporaryClose={() => setSidebarPeek(false)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onProjectCreated={(project) => setProjects((current) => [...current, project])}
          onOpenProject={() => void openProject()}
          onPageCreated={addPage}
          onSelectPage={(pageId) => {
            setSelectedPageId(pageId);
            setActiveTab('chat');
          }}
        />
      )}
      {sidebarCollapsed && (
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="fixed top-4 left-4 z-10 h-7 min-h-7 w-7 min-w-7 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          onMouseEnter={() => sidebarPeekEnabled && setSidebarPeek(true)}
          onMouseLeave={() => setSidebarPeekEnabled(true)}
          onPress={pinSidebarOpen}
          aria-label="展开侧边栏"
        >
          <PanelLeft size={17} />
        </Button>
      )}

      {isSettingsOpen ? (
        <SettingsPage
          theme={theme}
          userProfile={userProfile}
          onThemeChange={setTheme}
          onProfileChange={setUserProfile}
          onBack={() => setIsSettingsOpen(false)}
        />
      ) : (
        <Workspace
          page={selectedPage}
          projectId={selectedProject?.id}
          mode={activeTab}
          sidebarCollapsed={sidebarCollapsed}
          onModeChange={setActiveTab}
          onCreateProject={() => setIsHomeProjectModalOpen(true)}
        />
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
