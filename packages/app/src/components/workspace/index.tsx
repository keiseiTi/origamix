import { useState, type RefObject } from 'react';
import type { PageItem } from '../sidebar';
import { ChatWorkspace } from './chat-workspace';
import { Editor, type EditorHandle } from '../editor';
import { PreviewTab } from '../editor/mods/preview-tab';
import { EmptyWorkspace } from './empty-workspace';
import { WorkspaceHeader, type WorkspaceMode } from './workspace-header';

interface WorkspaceProps {
  page?: PageItem;
  projectId?: string;
  projectName?: string;
  mode: WorkspaceMode;
  sidebarCollapsed: boolean;
  onCreateProject: () => void;
  editorRef: RefObject<EditorHandle | null>;
  onModeChange: (mode: WorkspaceMode) => Promise<void>;
}

export function Workspace({
  page,
  projectId,
  projectName,
  mode,
  sidebarCollapsed,
  onCreateProject,
  editorRef,
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
              <Editor
                key={`${projectId}:${page.id}`}
                ref={editorRef}
                projectId={projectId}
                pageId={page.id}
              />
            </div>
          )}
          {projectId && mode === 'preview' && <PreviewTab projectId={projectId} pageId={page.id} />}
        </>
      )}
    </section>
  );
}

export type { WorkspaceMode } from './workspace-header';
