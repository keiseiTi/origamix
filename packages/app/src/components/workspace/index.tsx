import { useState, type RefObject } from 'react';
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
  schemaRefreshKey: string;
  onSchemaCommitted: (revisionId: string) => void;
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
  schemaRefreshKey,
  onSchemaCommitted,
}: WorkspaceProps): React.JSX.Element {
  const [runningPages, setRunningPages] = useState<Record<string, boolean>>({});
  const agentRunning = page ? runningPages[page.id] === true : false;
  const chat = page && projectId && (
    <ChatWorkspace
      projectId={projectId}
      pageId={page.id}
      pageName={page.name}
      draft={draft}
      onDraftChange={onDraftChange}
      onSchemaCommitted={onSchemaCommitted}
      onRunningChange={(running) =>
        setRunningPages((current) =>
          current[page.id] === running ? current : { ...current, [page.id]: running },
        )
      }
    />
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
                key={`${projectId}:${page.id}:${schemaRefreshKey}`}
                ref={editorRef}
                projectId={projectId}
                pageId={page.id}
                readOnly={agentRunning}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}

export type { WorkspaceMode } from './workspace-header';
