import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePreferencesStore } from '@/store/preferences';
import { useWorkspaceStore, type PageItem } from '@/store/workspace';
import { ChatWorkspace } from '@/components/agent-chat';
import { PageEditor } from '@/components/editor';
import {
  useCreateEditor,
  createEditorModePlugin,
  createViewportPlugin,
  createHistoryPlugin,
  type EditorHandle,
} from '@origamix/editor';
import type { WorkspaceMode } from './page-toolbar';
import { AgentChatToolbar } from './agent-chat-toolbar';
import { createWorkspaceToolbarPlugin } from './workspace-toolbar-plugin';
import { WorkspaceToolbarProvider } from './workspace-toolbar';
import { usePageSession } from './hooks/use-page-session';
import { PagePreviewFrame } from './preview/page-preview-frame';

export interface PageSessionProps {
  active?: boolean;
  pageId: string;
  editorRef: RefObject<EditorHandle | null>;
  onModeChange: (mode: WorkspaceMode) => Promise<void>;
  onPreview: () => Promise<void>;
  onConfigureModel?: () => void;
}

export const PageSession = ({
  active = true,
  pageId,
  editorRef,
  onModeChange,
  onPreview,
  onConfigureModel,
}: PageSessionProps): React.JSX.Element => {
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
  if (!page || !project) throw new Error(`页面 ${pageId} 不在当前工作区中`);

  return (
    <PageSessionContent
      active={active}
      page={page}
      projectId={project.id}
      projectName={project.name}
      editorRef={editorRef}
      onModeChange={onModeChange}
      onPreview={onPreview}
      onConfigureModel={onConfigureModel}
    />
  );
};

const PageSessionContent = ({
  active = true,
  page,
  projectId,
  projectName,
  editorRef,
  onModeChange,
  onPreview,
  onConfigureModel,
}: Omit<PageSessionProps, 'pageId'> & {
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
  const editor = useCreateEditor({
    plugins: [
      createWorkspaceToolbarPlugin(),
      createEditorModePlugin(),
      createViewportPlugin(),
      createHistoryPlugin(),
    ],
    beforeModeChange: async () => {
      await editorRef.current?.flush();
    },
  });
  const [clarificationHighlight, setClarificationHighlight] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== 'preview') previousMode.current = mode;
  }, [mode]);
  const { application, agent, capabilities, schemaRefreshKey } = usePageSession({
    projectId,
    pageId: page.id,
    active,
    editorRef,
  });
  const setPageStatus = useWorkspaceStore((state) => state.setPageStatus);
  const onWorkingCommitted = useCallback((): void => {
    void application.refreshApplyState();
  }, [application]);

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
  // signal directly into the editor lifecycle while the page session refreshes
  // its application state.
  const editorSchemaRefreshKey = `${schemaRefreshKey}:${agent.state.workingRefreshKey ?? ''}`;
  const toolbarProps = {
    active: active,
    projectName: projectName ?? '未命名项目',
    pageName: page.name,
    projectId: projectId,
    pageId: page.id,
    onModeChange: onModeChange,
    onPreview: onPreview,
    onSaveVersion: application.saveVersion,
    onApply: application.applyPage,
    onReloadFromProject: application.reloadFromProject,
    onRestoreRevision: application.restoreRevision,
    applyStatus: application.applyStatus,
    canApply: capabilities.canApply,
    canSaveVersion: capabilities.canSaveVersion,
    canReload: capabilities.canReload,
    canRestore: capabilities.canEdit,
  };

  return (
    <section className='relative flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950'>
      <div className={mode === 'chat' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <AgentChatToolbar {...toolbarProps} active={active && mode === 'chat'} />
        <ChatWorkspace
          pageName={page.name}
          draft={draft}
          onDraftChange={(value) => setPageDraft(page.id, value)}
          session={agent}
          onViewChanges={() => onModeChange('edit')}
          onConfigureModel={onConfigureModel}
          onClarificationHover={setClarificationHighlight}
        />
      </div>
      <div className={mode === 'edit' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <WorkspaceToolbarProvider value={{ ...toolbarProps, active: active && mode === 'edit' }}>
          <PageEditor
            visible={active && mode === 'edit'}
            schemaRefreshKey={editorSchemaRefreshKey}
            ref={editorRef}
            editor={editor}
            projectId={projectId}
            pageId={page.id}
            onReturnToChat={() => onModeChange('chat')}
            onSave={application.saveVersion}
            canSave={active && mode === 'edit' && capabilities.canSaveVersion}
            onWorkingCommitted={onWorkingCommitted}
            readOnly={!capabilities.canEdit}
            readOnlyMessage={
              capabilities.agentChecking
                ? '正在确认页面运行状态，请稍候'
                : 'AI 正在修改，编辑暂时锁定'
            }
            targetSelection={{
              candidates: agent.clarificationExpired
                ? []
                : (agent.state.run?.clarification?.candidates ?? []),
              highlightedElementId: clarificationHighlight,
              disabled: agent.clarificationExpired,
              onSelect: (elementId) =>
                void agent.selectClarification(elementId).catch(() => undefined),
            }}
          />
        </WorkspaceToolbarProvider>
      </div>
      <div className={mode === 'preview' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <PagePreviewFrame
          active={active && mode === 'preview'}
          projectId={projectId}
          pageId={page.id}
          pageName={page.name}
          schemaRefreshKey={editorSchemaRefreshKey}
          theme={theme}
          onExit={() => void onModeChange(previousMode.current)}
        />
      </div>
    </section>
  );
};
