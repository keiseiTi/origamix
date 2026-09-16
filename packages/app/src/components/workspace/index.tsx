import { useState, type RefObject } from 'react';
import type { PageItem } from '../../store/workspace';
import { ChatWorkspace } from '../agent-chat';
import { Editor, type EditorHandle } from '../editor';
import { EmptyWorkspace } from './empty-workspace';
import { WorkspaceHeader, type WorkspaceMode } from './workspace-header';
import { usePageApplicationState } from './state/use-page-application-state';

interface WorkspaceProps {
  page?: PageItem;
  projectId?: string;
  projectName?: string;
  mode: WorkspaceMode;
  onCreateProject: () => void;
  editorRef: RefObject<EditorHandle | null>;
  onModeChange: (mode: WorkspaceMode) => Promise<void>;
  onPreview: () => Promise<void>;
  onUndo: () => Promise<void>;
  draft: string;
  onDraftChange: (draft: string) => void;
  supportsNativeProjectDirectories: boolean;
  schemaRefreshKey: string;
  onSchemaCommitted: (pageId: string, revisionId: string) => void;
}

export const Workspace = ({
  page,
  projectId,
  projectName,
  mode,
  onCreateProject,
  editorRef,
  onModeChange,
  onPreview,
  onUndo,
  draft,
  onDraftChange,
  supportsNativeProjectDirectories,
  schemaRefreshKey,
  onSchemaCommitted,
}: WorkspaceProps): React.JSX.Element => {
  const [runningPages, setRunningPages] = useState<Record<string, boolean>>({});
  const { applyStatus, saveStatus, setSaveStatus, applyPage, reloadFromProject } =
    usePageApplicationState({
      projectId,
      pageId: page?.id,
      schemaRefreshKey,
      editorRef,
      onSchemaCommitted,
    });
  const agentRunning = page ? runningPages[page.id] === true : false;
  const chat = page && projectId && (
    <ChatWorkspace
      key={`${projectId}:${page.id}`}
      projectId={projectId}
      pageId={page.id}
      pageName={page.name}
      draft={draft}
      onDraftChange={onDraftChange}
      onSchemaCommitted={(revisionId) => onSchemaCommitted(page.id, revisionId)}
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
          onUndo={onUndo}
          onApply={applyPage}
          onReloadFromProject={reloadFromProject}
          applyStatus={applyStatus}
          saveStatus={saveStatus}
          undoDisabled={agentRunning}
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
                onSaveStatusChange={setSaveStatus}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
};

export type { WorkspaceMode } from './workspace-header';
