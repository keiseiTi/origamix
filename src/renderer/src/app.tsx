import { Button } from '@heroui/react'
import { PanelLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Sidebar,
  type AppTheme,
  type PageItem,
  type ProjectItem,
  type UserProfile
} from './components/sidebar'
import { CreateProjectModal } from './components/sidebar/mod/create-project-modal'
import { SettingsPage } from './components/settings-page'
import { Workspace, type WorkspaceMode } from './components/workspace'

const initialProjects: ProjectItem[] = [
  {
    id: 'project_origamix',
    name: 'Origamix 项目',
    pages: [
      { id: 'page_customer', name: '客户列表', fileName: 'customer-list' },
      { id: 'page_dashboard', name: '数据看板', fileName: 'dashboard' }
    ]
  },
  { id: 'project_demo', name: '演示项目', pages: [] }
]

const themeStorageKey = 'origamix-theme'

function getInitialTheme(): AppTheme {
  const storedTheme = localStorage.getItem(themeStorageKey)
  return storedTheme === 'dark' ? 'dark' : 'light'
}

function App(): React.JSX.Element {
  const [projects, setProjects] = useState(initialProjects)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<WorkspaceMode>('chat')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarPeek, setSidebarPeek] = useState(false)
  const [sidebarPeekEnabled, setSidebarPeekEnabled] = useState(true)
  const [theme, setTheme] = useState<AppTheme>(getInitialTheme)
  const [isHomeProjectModalOpen, setIsHomeProjectModalOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: 'Origamix 用户',
    iconBackground: '#2563eb'
  })
  const selectedPage = projects
    .flatMap((project) => project.pages)
    .find((page) => page.id === selectedPageId)
  const sidebarVisible = !sidebarCollapsed || sidebarPeek

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(themeStorageKey, theme)
  }, [theme])

  useEffect(() => {
    window.api.settings
      .getProfile()
      .then(setUserProfile)
      .catch(() => undefined)
  }, [])

  const collapseSidebar = (): void => {
    setSidebarCollapsed(true)
    setSidebarPeek(false)
    setSidebarPeekEnabled(false)
  }

  const pinSidebarOpen = (): void => {
    setSidebarCollapsed(false)
    setSidebarPeek(false)
    setSidebarPeekEnabled(true)
  }

  const addPage = (projectId: string, page: PageItem): void => {
    setProjects((current) =>
      current.map((project) =>
        project.id === projectId ? { ...project, pages: [...project.pages, page] } : project
      )
    )
    setSelectedPageId(page.id)
  }

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
          onPageCreated={addPage}
          onSelectPage={(pageId) => {
            setSelectedPageId(pageId)
            setActiveTab('chat')
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
  )
}

export default App
