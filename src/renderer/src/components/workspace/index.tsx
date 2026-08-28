import type { PageItem } from '../sidebar'
import { ChatWorkspace } from './chat-workspace'
import { EditorWorkspace } from './editor-workspace'
import { EmptyWorkspace } from './empty-workspace'
import { WorkspaceHeader, type WorkspaceMode } from './workspace-header'

interface WorkspaceProps {
  page?: PageItem
  mode: WorkspaceMode
  sidebarCollapsed: boolean
  onModeChange: (mode: WorkspaceMode) => void
  onCreateProject: () => void
}

export function Workspace({
  page,
  mode,
  sidebarCollapsed,
  onModeChange,
  onCreateProject
}: WorkspaceProps): React.JSX.Element {
  return (
    <section className="relative flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950">
      {page && (
        <WorkspaceHeader
          pageName={page.name}
          mode={mode}
          sidebarCollapsed={sidebarCollapsed}
          onModeChange={onModeChange}
        />
      )}
      {!page ? (
        <EmptyWorkspace onCreateProject={onCreateProject} />
      ) : mode === 'chat' ? (
        <ChatWorkspace pageName={page.name} />
      ) : (
        <EditorWorkspace fileName={page.fileName} />
      )}
    </section>
  )
}

export type { WorkspaceMode } from './workspace-header'
