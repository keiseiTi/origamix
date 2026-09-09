import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { PageItem } from '../sidebar';
import { ChatWorkspace } from '../agent-chat';
import { Editor, type EditorHandle } from '../editor';
import { EmptyWorkspace } from './empty-workspace';
import { WorkspaceHeader, type WorkspaceMode } from './workspace-header';
import { schemaService } from '../../services/schema';

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

export function Workspace({
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
}: WorkspaceProps): React.JSX.Element {
  const [runningPages, setRunningPages] = useState<Record<string, boolean>>({});
  const [applyStatus, setApplyStatus] = useState<
    'loading' | 'in_sync' | 'pending' | 'external_change' | 'error'
  >('loading');
  const agentRunning = page ? runningPages[page.id] === true : false;
  const refreshApplyState = useCallback(async (): Promise<void> => {
    if (!page || !projectId) return;
    try {
      setApplyStatus((await schemaService.applyState(projectId, page.id)).status);
    } catch {
      setApplyStatus('error');
    }
  }, [page, projectId]);
  useEffect(() => {
    const initial = window.setTimeout(() => void refreshApplyState(), 0);
    const timer = window.setInterval(() => void refreshApplyState(), 1500);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refreshApplyState, schemaRefreshKey]);
  const applyPage = async (): Promise<void> => {
    if (!page || !projectId) return;
    await editorRef.current?.flush();
    const current = await schemaService.get(projectId, page.id);
    await schemaService.apply(projectId, page.id, current.revisionId);
    await refreshApplyState();
  };
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
          applyStatus={applyStatus}
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
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}

export type { WorkspaceMode } from './workspace-header';
