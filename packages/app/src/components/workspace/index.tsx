import { useEffect, useRef, type RefObject } from 'react';
import type { PageItem } from '../../store/workspace';
import type { AppTheme } from '../../store/preferences';
import { ChatWorkspace } from '../agent-chat';
import { Editor, type EditorHandle } from '../editor';
import { EmptyWorkspace } from './empty-workspace';
import { WorkspaceHeader, type WorkspaceMode } from './workspace-header';
import { usePageSession } from './state/use-page-session';
import { PagePreviewFrame } from './page-preview-frame';

interface WorkspaceProps {
  active?: boolean;
  page?: PageItem;
  projectId?: string;
  projectName?: string;
  mode: WorkspaceMode;
  theme: AppTheme;
  onCreateProject: () => void;
  editorRef: RefObject<EditorHandle | null>;
  onModeChange: (mode: WorkspaceMode) => Promise<void>;
  onPreview: () => Promise<void>;
  draft: string;
  onDraftChange: (draft: string) => void;
  supportsNativeProjectDirectories: boolean;
  schemaRefreshKey: string;
  onSchemaCommitted: (pageId: string, revisionId: string) => void;
}

export const Workspace = ({
  active = true,
  page,
  projectId,
  projectName,
  mode,
  theme,
  onCreateProject,
  editorRef,
  onModeChange,
  onPreview,
  draft,
  onDraftChange,
  supportsNativeProjectDirectories,
  schemaRefreshKey,
  onSchemaCommitted,
}: WorkspaceProps): React.JSX.Element => {
  if (!page || !projectId)
    return (
      <section className='relative flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950'>
        <EmptyWorkspace
          onCreateProject={onCreateProject}
          supportsNativeProjectDirectories={supportsNativeProjectDirectories}
        />
      </section>
    );

  return (
    <PageWorkspace
      active={active}
      page={page}
      projectId={projectId}
      projectName={projectName}
      mode={mode}
      theme={theme}
      editorRef={editorRef}
      onModeChange={onModeChange}
      onPreview={onPreview}
      draft={draft}
      onDraftChange={onDraftChange}
      schemaRefreshKey={schemaRefreshKey}
      onSchemaCommitted={onSchemaCommitted}
    />
  );
};

const PageWorkspace = ({
  active = true,
  page,
  projectId,
  projectName,
  mode,
  theme,
  editorRef,
  onModeChange,
  onPreview,
  draft,
  onDraftChange,
  schemaRefreshKey,
  onSchemaCommitted,
}: Omit<
  WorkspaceProps,
  'page' | 'projectId' | 'onCreateProject' | 'supportsNativeProjectDirectories'
> & {
  page: PageItem;
  projectId: string;
}): React.JSX.Element => {
  const previousMode = useRef<Exclude<WorkspaceMode, 'preview'>>('chat');
  useEffect(() => {
    if (mode !== 'preview') previousMode.current = mode;
  }, [mode]);
  const { application, agent, capabilities } = usePageSession({
    projectId,
    pageId: page.id,
    schemaRefreshKey,
    active,
    editorRef,
    onSchemaCommitted,
  });
  const chat = (
    <ChatWorkspace
      pageName={page.name}
      draft={draft}
      onDraftChange={onDraftChange}
      session={agent}
      onViewChanges={() => onModeChange('edit')}
    />
  );
  return (
    <section className='relative flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950'>
      {mode !== 'preview' && (
        <WorkspaceHeader
          active={active}
          projectName={projectName ?? '未命名项目'}
          pageName={page.name}
          projectId={projectId}
          pageId={page.id}
          mode={mode}
          onModeChange={onModeChange}
          onPreview={onPreview}
          onSaveVersion={application.saveVersion}
          onApply={application.applyPage}
          onReloadFromProject={application.reloadFromProject}
          onRestoreRevision={application.restoreRevision}
          applyStatus={application.applyStatus}
          canApply={capabilities.canApply}
          canSaveVersion={capabilities.canSaveVersion}
          canReload={capabilities.canReload}
          canRestore={capabilities.canEdit}
        />
      )}
      <>
        <div className={mode === 'chat' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>{chat}</div>
        <div className={mode === 'edit' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
          <Editor
            key={`${projectId}:${page.id}:${schemaRefreshKey}`}
            ref={editorRef}
            projectId={projectId}
            pageId={page.id}
            readOnly={!capabilities.canEdit}
            readOnlyMessage={
              capabilities.agentChecking ? '正在确认页面运行状态，请稍候' : undefined
            }
          />
        </div>
        <div className={mode === 'preview' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
          <PagePreviewFrame
            active={active && mode === 'preview'}
            projectId={projectId}
            pageId={page.id}
            pageName={page.name}
            theme={theme}
            onExit={() => void onModeChange(previousMode.current)}
          />
        </div>
      </>
    </section>
  );
};

export type { WorkspaceMode } from './workspace-header';
