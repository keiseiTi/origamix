import { Button, TextArea, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { Eye, FilePlus2, LayoutPanelLeft, PanelLeft, Plus, Send, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Sidebar, type AppTheme, type PageItem, type ProjectItem } from './components/sidebar'
import { CreateProjectModal } from './components/sidebar/mod/create-project-modal'

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
  const [activeTab, setActiveTab] = useState<'chat' | 'edit'>('chat')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarPeek, setSidebarPeek] = useState(false)
  const [sidebarPeekEnabled, setSidebarPeekEnabled] = useState(true)
  const [theme, setTheme] = useState<AppTheme>(getInitialTheme)
  const [isHomeProjectModalOpen, setIsHomeProjectModalOpen] = useState(false)
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
          theme={theme}
          onCollapse={collapseSidebar}
          onPin={pinSidebarOpen}
          onTemporaryClose={() => setSidebarPeek(false)}
          onThemeChange={setTheme}
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

      <section className="relative flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950">
        {selectedPage && (
          <header className="relative grid h-15 min-h-15 grid-cols-[1fr_auto_1fr] items-center border-b border-zinc-200 px-4.5 dark:border-zinc-800">
            <div className={`flex items-center font-semibold ${sidebarCollapsed ? 'pl-9' : ''}`}>
              <span>{selectedPage.name}</span>
            </div>
            <ToggleButtonGroup
              aria-label="页面模式"
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={new Set([activeTab])}
              onSelectionChange={(keys) => {
                const selectedMode = [...keys][0]
                if (selectedMode === 'chat' || selectedMode === 'edit') setActiveTab(selectedMode)
              }}
              size="sm"
              className="h-8 min-w-34"
            >
              <ToggleButton id="chat" className="min-w-16 text-xs">
                对话
              </ToggleButton>
              <ToggleButton id="edit" className="min-w-16 text-xs">
                编辑
              </ToggleButton>
            </ToggleButtonGroup>
            <Button className="justify-self-end gap-1.5" size="sm" variant="secondary">
              <Eye size={14} />
              <span>预览</span>
            </Button>
          </header>
        )}
        {!selectedPage ? (
          <div className="flex flex-1 flex-col items-center justify-center pb-12 text-center">
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl border border-zinc-200 bg-zinc-50 text-blue-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-blue-400">
              <Sparkles size={22} />
            </div>
            <h1 className="m-0 text-xl font-semibold tracking-tight">现在开始 AI Schema 旅程吧</h1>
            <p className="mt-2 mb-5 text-zinc-500 dark:text-zinc-400">
              从左侧选择页面，或新建一个项目开始。
            </p>
            <Button className="gap-1.5" onPress={() => setIsHomeProjectModalOpen(true)}>
              <Plus size={14} />
              新建项目
            </Button>
          </div>
        ) : activeTab === 'chat' ? (
          <div className="flex min-h-0 flex-1 flex-col items-center">
            <div className="w-[min(780px,calc(100%-64px))] flex-1 py-16 pb-7">
              <div className="flex gap-3 leading-relaxed">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
                  <Sparkles size={14} />
                </span>
                <div>
                  <strong className="text-sm">准备好修改“{selectedPage.name}”</strong>
                  <p className="mt-1 max-w-155 text-zinc-600 dark:text-zinc-300">
                    告诉我你希望这个页面包含什么。我会先生成候选 Schema，通过校验后再更新页面。
                  </p>
                </div>
              </div>
            </div>
            <div className="w-[min(780px,calc(100%-64px))] rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-[0_8px_24px_rgb(0_0_0/0.1)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-[0_8px_24px_rgb(0_0_0/0.35)]">
              <TextArea
                variant="secondary"
                className="block min-h-16 w-full resize-none border-0 bg-transparent px-2 py-1.5 shadow-none outline-none"
                aria-label="发送消息"
                placeholder="描述你想创建或修改的页面"
              />
              <footer className="flex items-center justify-between">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"
                >
                  <LayoutPanelLeft size={14} />
                  页面上下文
                </Button>
                <Button isIconOnly size="sm" className="h-7 min-h-7 w-7 min-w-7" aria-label="发送">
                  <Send size={15} />
                </Button>
              </footer>
            </div>
            <p className="mt-2 mb-2.5 text-[10px] text-zinc-400 dark:text-zinc-500">
              AI 可能会出错，请检查生成结果。
            </p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col bg-zinc-50 p-4 dark:bg-zinc-900">
            <div className="flex h-8 items-center justify-between px-2.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1.5">
                <FilePlus2 size={14} />
                {selectedPage.fileName}.schema.json
              </span>
              <span>已保存</span>
            </div>
            <div className="grid min-h-0 flex-1 place-items-center rounded-lg border border-zinc-200 bg-white [background-image:radial-gradient(#e2e2e2_1px,transparent_1px)] [background-size:16px_16px] dark:border-zinc-700 dark:bg-zinc-950 dark:[background-image:radial-gradient(#3f3f46_1px,transparent_1px)]">
              <div className="flex flex-col items-center gap-2 rounded-xl border border-zinc-200 bg-white p-7 text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                <LayoutPanelLeft size={24} />
                <strong className="text-zinc-900 dark:text-zinc-100">页面编辑画布</strong>
                <span>Schema Runtime 将在此处渲染。</span>
              </div>
            </div>
          </div>
        )}
      </section>

      <CreateProjectModal
        isOpen={isHomeProjectModalOpen}
        onClose={() => setIsHomeProjectModalOpen(false)}
        onCreated={(project) => setProjects((current) => [...current, project])}
      />
    </main>
  )
}

export default App
