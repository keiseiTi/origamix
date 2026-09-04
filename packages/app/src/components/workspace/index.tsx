import type { RefObject } from 'react';
import type { PageItem } from '../sidebar';
import { ChatWorkspace } from './chat-workspace';
import { Editor, type EditorHandle } from '../editor';
import { EmptyWorkspace } from './empty-workspace';
import { WorkspaceHeader, type WorkspaceMode } from './workspace-header';

interface WorkspaceProps {
  page?: PageItem;
  projectId?: string;
  projectName?: string;
  mode: WorkspaceMode;
  onCreateProject: () => void;
  editorRef: RefObject<EditorHandle | null>;
  onModeChange: (mode: WorkspaceMode) => Promise<void>;
  onPreview: () => Promise<void>;
  draft: string;
  onDraftChange: (draft: string) => void;
  supportsNativeProjectDirectories: boolean;
}

export function Workspace({
  page,
  projectId,
  projectName,
  mode,
  onCreateProject,
  editorRef,
  onModeChange,
  onPreview,
  draft,
  onDraftChange,
  supportsNativeProjectDirectories,
}: WorkspaceProps): React.JSX.Element {
  const chat = page && (
    <ChatWorkspace pageName={page.name} draft={draft} onDraftChange={onDraftChange} />
  );
  return (
    <section className='relative flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950'>
      {page && projectId && mode !== 'preview' && (
        <WorkspaceHeader
          projectName={projectName ?? '未命名项目'}
          pageName={page.name}
          mode={mode}
          onModeChange={onModeChange}
          onPreview={onPreview}
        />
      )}
      {!page ? (
        <EmptyWorkspace
          onCreateProject={onCreateProject}
          supportsNativeProjectDirectories={supportsNativeProjectDirectories}
        />
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
        </>
      )}
    </section>
  );
}

export type { WorkspaceMode } from './workspace-header';
