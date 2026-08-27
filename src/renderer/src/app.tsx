import { Button, Input } from '@heroui/react'
import {
  ChevronLeft,
  Eye,
  FilePlus2,
  Folder,
  FolderPlus,
  LayoutPanelLeft,
  MessageSquareText,
  PanelLeft,
  Plus,
  Send,
  Settings,
  Sparkles,
  X
} from 'lucide-react'
import { useState } from 'react'
import './app.less'

interface PageItem {
  id: string
  name: string
  fileName: string
}
interface ProjectItem {
  id: string
  name: string
  path?: string
  pages: PageItem[]
}
type ModalState = { type: 'project' } | { type: 'page'; projectId: string } | null

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

function Dialog({
  title,
  children,
  onClose
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}): React.JSX.Element {
  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

function App(): React.JSX.Element {
  const [projects, setProjects] = useState(initialProjects)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'chat' | 'edit'>('chat')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarPeek, setSidebarPeek] = useState(false)
  const [modal, setModal] = useState<ModalState>(null)
  const [projectName, setProjectName] = useState('')
  const [directory, setDirectory] = useState('')
  const [pageName, setPageName] = useState('')
  const [fileName, setFileName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectedPage = projects
    .flatMap((project) => project.pages)
    .find((page) => page.id === selectedPageId)
  const sidebarVisible = !sidebarCollapsed || sidebarPeek

  const resetDialog = (): void => {
    setModal(null)
    setProjectName('')
    setDirectory('')
    setPageName('')
    setFileName('')
    setError(null)
  }
  const chooseDirectory = async (): Promise<void> => {
    const selected = await window.api.project.chooseDirectory()
    if (selected) setDirectory(selected)
  }
  const createProject = async (): Promise<void> => {
    if (!projectName.trim() || !directory) return setError('请填写项目名称并选择生成地址。')
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await window.api.project.create({
        name: projectName.trim(),
        parentDirectory: directory
      })
      setProjects((current) => [
        ...current,
        {
          id: `project_${crypto.randomUUID()}`,
          name: projectName.trim(),
          path: result.projectPath,
          pages: []
        }
      ])
      resetDialog()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '项目创建失败')
    } finally {
      setIsSubmitting(false)
    }
  }
  const createPage = async (projectId: string): Promise<void> => {
    if (!pageName.trim() || !fileName.trim()) return setError('请填写页面名称和文件名称。')
    const project = projects.find((item) => item.id === projectId)
    setIsSubmitting(true)
    setError(null)
    try {
      if (project?.path)
        await window.api.page.create({
          projectPath: project.path,
          name: pageName.trim(),
          fileName: fileName.trim()
        })
      const page = {
        id: `page_${crypto.randomUUID()}`,
        name: pageName.trim(),
        fileName: fileName.trim()
      }
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId ? { ...project, pages: [...project.pages, page] } : project
        )
      )
      setSelectedPageId(page.id)
      resetDialog()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '页面创建失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="app-shell">
      {sidebarCollapsed && !sidebarPeek && (
        <div className="sidebar-reveal-zone" onMouseEnter={() => setSidebarPeek(true)} />
      )}
      {sidebarVisible && (
        <aside
          className={`sidebar ${sidebarCollapsed ? 'sidebar--floating' : ''}`}
          onMouseLeave={() => sidebarCollapsed && setSidebarPeek(false)}
        >
          <header className="sidebar__header">
            <strong>
              <span className="brand-mark">
                <Sparkles size={14} />
              </span>
              Origamix
            </strong>
            <button
              className="icon-button"
              onClick={() => {
                setSidebarCollapsed(true)
                setSidebarPeek(false)
              }}
              aria-label="收起侧边栏"
            >
              <ChevronLeft size={16} />
            </button>
          </header>
          <button className="new-project" onClick={() => setModal({ type: 'project' })}>
            <FolderPlus size={15} />
            新建项目
          </button>
          <div className="sidebar__label">项目</div>
          <nav className="project-tree">
            {projects.map((project) => (
              <section className="project" key={project.id}>
                <div className="project__row">
                  <Folder size={14} />
                  <span>{project.name}</span>
                  <button
                    className="project__add"
                    onClick={() => setModal({ type: 'page', projectId: project.id })}
                    aria-label={`在 ${project.name} 中新建页面`}
                  >
                    <Plus size={14} />
                  </button>
                </div>
                {project.pages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => {
                      setSelectedPageId(page.id)
                      setActiveTab('chat')
                    }}
                    className={`page-row ${selectedPageId === page.id ? 'is-active' : ''}`}
                  >
                    <MessageSquareText size={13} />
                    <span>{page.name}</span>
                  </button>
                ))}
              </section>
            ))}
          </nav>
          <button className="settings-button">
            <Settings size={16} />
            <span>设置</span>
          </button>
        </aside>
      )}

      <section className="workspace">
        <header className="workspace__header">
          <div className="workspace__title">
            {sidebarCollapsed && (
              <button
                className="icon-button sidebar-open"
                onMouseEnter={() => setSidebarPeek(true)}
                onClick={() => setSidebarCollapsed(false)}
                aria-label="展开侧边栏"
              >
                <PanelLeft size={16} />
              </button>
            )}
            <span>{selectedPage?.name ?? '主页'}</span>
          </div>
          {selectedPage && (
            <div className="workspace-tabs">
              <button
                className={activeTab === 'chat' ? 'is-active' : ''}
                onClick={() => setActiveTab('chat')}
              >
                对话
              </button>
              <button
                className={activeTab === 'edit' ? 'is-active' : ''}
                onClick={() => setActiveTab('edit')}
              >
                编辑
              </button>
            </div>
          )}
          <Button size="sm" variant="secondary" isDisabled={!selectedPage}>
            <Eye size={14} />
            预览
          </Button>
        </header>
        {!selectedPage ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <Sparkles size={22} />
            </div>
            <h1>现在开始 AI Schema 旅程吧</h1>
            <p>从左侧选择页面，或新建一个项目开始。</p>
            <Button onPress={() => setModal({ type: 'project' })}>
              <Plus size={14} />
              新建项目
            </Button>
          </div>
        ) : activeTab === 'chat' ? (
          <div className="chat-view">
            <div className="chat-thread">
              <div className="agent-message">
                <span className="agent-avatar">
                  <Sparkles size={14} />
                </span>
                <div>
                  <strong>准备好修改“{selectedPage.name}”</strong>
                  <p>告诉我你希望这个页面包含什么。我会先生成候选 Schema，通过校验后再更新页面。</p>
                </div>
              </div>
            </div>
            <div className="composer">
              <textarea aria-label="发送消息" placeholder="描述你想创建或修改的页面" />
              <footer>
                <button className="context-button">
                  <LayoutPanelLeft size={14} />
                  页面上下文
                </button>
                <button className="send-button" aria-label="发送">
                  <Send size={15} />
                </button>
              </footer>
            </div>
            <p className="composer-note">AI 可能会出错，请检查生成结果。</p>
          </div>
        ) : (
          <div className="editor-view">
            <div className="editor-toolbar">
              <span>
                <FilePlus2 size={14} />
                {selectedPage.fileName}.schema.json
              </span>
              <span>已保存</span>
            </div>
            <div className="canvas">
              <div className="canvas__empty">
                <LayoutPanelLeft size={24} />
                <strong>页面编辑画布</strong>
                <span>Schema Runtime 将在此处渲染。</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {modal?.type === 'project' && (
        <Dialog title="新建项目" onClose={resetDialog}>
          <div className="dialog__body">
            <label>
              项目名称
              <Input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="例如：客户管理系统"
                autoFocus
              />
            </label>
            <label>
              生成地址
              <div className="path-picker">
                <Input value={directory} readOnly placeholder="选择项目生成目录" />
                <Button size="sm" variant="secondary" onPress={chooseDirectory}>
                  选择…
                </Button>
              </div>
            </label>
            {error && <p className="form-error">{error}</p>}
          </div>
          <footer className="dialog__footer">
            <Button size="sm" variant="secondary" onPress={resetDialog}>
              取消
            </Button>
            <Button size="sm" onPress={createProject} isDisabled={isSubmitting}>
              {isSubmitting ? '创建中…' : '创建项目'}
            </Button>
          </footer>
        </Dialog>
      )}
      {modal?.type === 'page' && (
        <Dialog title="新建页面" onClose={resetDialog}>
          <div className="dialog__body">
            <label>
              页面名称
              <Input
                value={pageName}
                onChange={(event) => setPageName(event.target.value)}
                placeholder="例如：客户列表"
                autoFocus
              />
            </label>
            <label>
              文件名称
              <Input
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
                placeholder="例如：customer-list"
              />
            </label>
            {error && <p className="form-error">{error}</p>}
          </div>
          <footer className="dialog__footer">
            <Button size="sm" variant="secondary" onPress={resetDialog}>
              取消
            </Button>
            <Button size="sm" isDisabled={isSubmitting} onPress={() => createPage(modal.projectId)}>
              {isSubmitting ? '创建中…' : '创建页面'}
            </Button>
          </footer>
        </Dialog>
      )}
    </main>
  )
}

export default App
