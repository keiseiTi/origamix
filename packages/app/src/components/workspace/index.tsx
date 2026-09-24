import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePreferencesStore } from '@/store/preferences';
import { useWorkspaceStore, type PageItem } from '@/store/workspace';
import { ChatWorkspace } from '../agent-chat';
import { Editor, type EditorHandle, type EditorHistoryState, type EditorTool } from '../editor';
import { EmptyWorkspace } from './empty-workspace';
import { WorkspaceHeader, type WorkspaceMode } from './workspace-header';
import { usePageSession } from './state/use-page-session';
import { PagePreviewFrame } from './page-preview-frame';

interface WorkspaceProps {
  active?: boolean;
  pageId?: string;
  onCreateProject: () => void;
  editorRef: RefObject<EditorHandle | null>;
  onModeChange: (mode: WorkspaceMode) => Promise<void>;
  onPreview: () => Promise<void>;
  onConfigureModel?: () => void;
  schemaRefreshKey: string;
  onSchemaCommitted: (pageId: string, revisionId: string) => void;
}

export const Workspace = ({
  active = true,
  pageId,
  onCreateProject,
  editorRef,
  onModeChange,
  onPreview,
  onConfigureModel,
  schemaRefreshKey,
  onSchemaCommitted,
}: WorkspaceProps): React.JSX.Element => {
  const { page, project } = useWorkspaceStore(
    useShallow((state) => {
      const project = state.projects.find((item) =>
        item.pages.some((candidate) => candidate.id === pageId),
      );
      return {
        project,
        page: project?.pages.find((candidate) => candidate.id === pageId),
      };
    }),
  );
  if (!page || !project)
    return (
      <section className='relative flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950'>
        <EmptyWorkspace onCreateProject={onCreateProject} />
      </section>
    );

  return (
    <PageWorkspace
      active={active}
      page={page}
      projectId={project.id}
      projectName={project.name}
      editorRef={editorRef}
      onModeChange={onModeChange}
      onPreview={onPreview}
      onConfigureModel={onConfigureModel}
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
  editorRef,
  onModeChange,
  onPreview,
  onConfigureModel,
  schemaRefreshKey,
  onSchemaCommitted,
}: Omit<WorkspaceProps, 'pageId' | 'onCreateProject'> & {
  page: PageItem;
  projectId: string;
  projectName: string;
}): React.JSX.Element => {
  const { mode, draft, setPageDraft } = useWorkspaceStore(
    useShallow((state) => ({
      mode: state.openPages.find((tab) => tab.id === page.id)?.mode ?? 'chat',
      draft: state.pageDrafts[page.id] ?? '',
      setPageDraft: state.setPageDraft,
    })),
  );
  const theme = usePreferencesStore((state) => state.theme);
  const previousMode = useRef<Exclude<WorkspaceMode, 'preview'>>('chat');
  const [viewportWidth, setViewportWidth] = useState(1440);
  const [editorTool, setEditorTool] = useState<EditorTool | null>(null);
  const [clarificationHighlight, setClarificationHighlight] = useState<string | null>(null);
  const [historyState, setHistoryState] = useState<EditorHistoryState>({
    canUndo: false,
    canRedo: false,
  });
  const updateHistoryState = useCallback((state: EditorHistoryState): void => {
    setHistoryState(state);
  }, []);
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
  const setPageStatus = useWorkspaceStore((state) => state.setPageStatus);
  useEffect(() => {
    const status = application.applyStatus;
    if (
      status === 'in_sync' ||
      status === 'draft_unsaved' ||
      status === 'saved_pending_apply' ||
      status === 'external_change'
    ) {
      setPageStatus(page.id, status);
    } else {
      setPageStatus(page.id, null);
    }
  }, [application.applyStatus, page.id, setPageStatus]);
  // Agent commits already carry the authoritative Working version. Feed that
  // signal directly into the editor lifecycle instead of waiting for the
  // workspace-level projection callback to make a round trip through App.
  const editorSchemaRefreshKey = agent.state.workingRefreshKey ?? schemaRefreshKey;
  const chat = (
    <ChatWorkspace
      pageName={page.name}
      draft={draft}
      onDraftChange={(value) => setPageDraft(page.id, value)}
      session={agent}
      onViewChanges={() => onModeChange('edit')}
      onConfigureModel={onConfigureModel}
      onClarificationHover={setClarificationHighlight}
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
          viewportWidth={viewportWidth}
          onViewportWidthChange={setViewportWidth}
          historyState={historyState}
          onUndo={() => editorRef.current?.undo()}
          onRedo={() => editorRef.current?.redo()}
          onOpenEditorTool={setEditorTool}
        />
      )}
      <>
        <div className={mode === 'chat' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>{chat}</div>
        <div className={mode === 'edit' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
          <Editor
            key={`${projectId}:${page.id}:${editorSchemaRefreshKey}`}
            ref={editorRef}
            projectId={projectId}
            pageId={page.id}
            viewportWidth={viewportWidth}
            tool={editorTool === 'history' ? null : editorTool}
            onCloseTool={() => setEditorTool(null)}
            onHistoryStateChange={updateHistoryState}
            readOnly={!capabilities.canEdit}
            readOnlyMessage={
              capabilities.agentChecking ? '正在确认页面运行状态，请稍候' : undefined
            }
            clarificationCandidates={agent.state.run?.clarification?.candidates}
            clarificationHighlightedElementId={clarificationHighlight}
            clarificationExpired={agent.clarificationExpired}
            onClarificationSelect={(elementId) =>
              void agent.selectClarification(elementId).catch(() => undefined)
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
