import type { RefObject } from 'react';
import type { PageItem } from '../../store/workspace';
import { ChatWorkspace } from '../agent-chat';
import { Editor, type EditorHandle } from '../editor';
import { EmptyWorkspace } from './empty-workspace';
import { WorkspaceHeader, type WorkspaceMode } from './workspace-header';
import { usePageSession } from './state/use-page-session';

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
      page={page}
      projectId={projectId}
      projectName={projectName}
      mode={mode}
      editorRef={editorRef}
      onModeChange={onModeChange}
      onPreview={onPreview}
      onUndo={onUndo}
      draft={draft}
      onDraftChange={onDraftChange}
      schemaRefreshKey={schemaRefreshKey}
      onSchemaCommitted={onSchemaCommitted}
    />
  );
};

const PageWorkspace = ({
  page,
  projectId,
  projectName,
  mode,
  editorRef,
  onModeChange,
  onPreview,
  onUndo,
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
  const { application, agent, capabilities } = usePageSession({
    projectId,
    pageId: page.id,
    schemaRefreshKey,
    editorRef,
    onSchemaCommitted,
  });
  const chat = (
    <ChatWorkspace
      pageName={page.name}
      draft={draft}
      onDraftChange={onDraftChange}
      session={agent}
    />
  );
  return (
    <section className='relative flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950'>
      {mode !== 'preview' && (
        <WorkspaceHeader
          projectName={projectName ?? '未命名项目'}
          pageName={page.name}
          mode={mode}
          onModeChange={onModeChange}
          onPreview={onPreview}
          onUndo={onUndo}
          onSaveVersion={application.saveVersion}
          onApply={application.applyPage}
          onReloadFromProject={application.reloadFromProject}
          applyStatus={application.applyStatus}
          saveStatus={application.saveStatus}
          canApply={capabilities.canApply}
          canSaveVersion={capabilities.canSaveVersion}
          canUndo={capabilities.canUndo}
          canReload={capabilities.canReload}
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
            onSaveStatusChange={application.setSaveStatus}
          />
        </div>
      </>
    </section>
  );
};

export type { WorkspaceMode } from './workspace-header';
