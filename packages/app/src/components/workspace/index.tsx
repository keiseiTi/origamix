import { useState } from 'react';
import type { PageItem } from '../sidebar';
import { ChatWorkspace } from './chat-workspace';
import { Editor } from '../editor';
import { EmptyWorkspace } from './empty-workspace';
import { WorkspaceHeader, type WorkspaceMode } from './workspace-header';

interface WorkspaceProps {
  page?: PageItem;
  projectId?: string;
  projectName?: string;
  mode: WorkspaceMode;
  sidebarCollapsed: boolean;
  onCreateProject: () => void;
  onModeChange: (mode: WorkspaceMode) => Promise<void>;
}

export function Workspace({
  page,
  projectId,
  projectName,
  mode,
  sidebarCollapsed,
  onCreateProject,
  onModeChange,
}: WorkspaceProps): React.JSX.Element {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const chat = page && (
    <ChatWorkspace
      pageName={page.name}
      draft={drafts[page.id] ?? ''}
      onDraftChange={(draft) => setDrafts((current) => ({ ...current, [page.id]: draft }))}
    />
  );
  return (
    <section className='relative flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950'>
      {page && projectId && (
        <WorkspaceHeader
          projectName={projectName ?? '未命名项目'}
          pageName={page.name}
          projectId={projectId}
          pageId={page.id}
          sidebarCollapsed={sidebarCollapsed}
          mode={mode}
          onModeChange={onModeChange}
        />
      )}
      {!page ? (
        <EmptyWorkspace onCreateProject={onCreateProject} />
      ) : (
        <>
          <div className={mode === 'chat' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>{chat}</div>
          {projectId && (
            <div className={mode === 'edit' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
              <Editor />
            </div>
          )}
        </>
      )}
    </section>
  );
}

export type { WorkspaceMode } from './workspace-header';
