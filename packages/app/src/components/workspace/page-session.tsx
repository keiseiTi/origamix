import { useCallback, useEffect, useState, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePreferencesStore } from '@/store/preferences';
import { useWorkspaceStore, type PageItem } from '@/store/workspace';
import { ChatWorkspace } from '@/components/agent-chat';
import { PageEditor } from '@/components/editor';
import { useCreateEditor, type EditorHandle } from '@origamix/editor';
import { AgentChatToolbar } from './agent-chat-toolbar';
import { createWorkspaceToolbarPlugin } from './workspace-toolbar-plugin';
import { usePageSession } from './hooks/use-page-session';
import { PagePreviewFrame } from './preview/page-preview-frame';

const workspaceToolbarPlugin = createWorkspaceToolbarPlugin();

export interface PageSessionProps {
  active?: boolean;
  pageId: string;
  editorRef: RefObject<EditorHandle | null>;
  onConfigureModel?: () => void;
}

export const PageSession = ({
  active = true,
  pageId,
  editorRef,
  onConfigureModel,
}: PageSessionProps): React.JSX.Element => {
  const { page, project } = useWorkspaceStore(
    useShallow((state) => {
      const tab = state.openPages.find((item) => item.id === pageId);
      const project = state.projects.find((item) => item.id === tab?.projectId);
      return {
        project,
        page: project?.pages.find((item) => item.id === pageId),
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
  const available = true;
  const theme = usePreferencesStore((state) => state.theme);
  const [clarificationHighlight, setClarificationHighlight] = useState<string | null>(null);
  const { pageApply, agent, capabilities, schemaRefreshKey } = usePageSession({
    projectId,
    pageId: page.id,
    available,
    active,
    editorRef,
  });
  const setPageStatus = useWorkspaceStore((state) => state.setPageStatus);
  const onWorkingCommitted = useCallback((): void => {
    void pageApply.refreshApplyState();
  }, [pageApply]);

  useEffect(() => {
    const status = pageApply.applyStatus;
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
  }, [pageApply.applyStatus, page.id, setPageStatus]);
  // Agent commits already carry the authoritative Working version. Feed that
  // signal directly into the editor lifecycle while the page session refreshes
  // its pageApply state.
  const editorSchemaRefreshKey = `${schemaRefreshKey}:${agent.state.workingRefreshKey ?? ''}`;
  const toolbarProps = {
    active: active,
    canPreview: true,
    projectName: projectName ?? '未命名项目',
    pageName: page.name,
    projectId: projectId,
    pageId: page.id,
    onSaveVersion: pageApply.saveVersion,
    onRefreshState: pageApply.refreshApplyState,
    onApply: pageApply.applyPage,
    onReloadFromProject: pageApply.reloadFromProject,
    onRestoreRevision: pageApply.restoreRevision,
    applyStatus: available ? pageApply.applyStatus : ('disabled' as const),
    canApply: capabilities.canApply,
    canSaveVersion: capabilities.canSaveVersion,
    canReload: capabilities.canReload,
    canRestore: capabilities.canEdit,
  };

  const editor = useCreateEditor({
    plugins: [
      workspaceToolbarPlugin.withProps({
        ...toolbarProps,
        active: active && mode === 'edit',
      }),
    ],
    beforeModeChange: async () => {
      await editorRef.current?.flush();
    },
  });

  return (
    <section className='relative flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950'>
      <div className={mode === 'chat' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <AgentChatToolbar {...toolbarProps} active={active && mode === 'chat'} />
        <ChatWorkspace
          pageId={page.id}
          pageName={page.name}
          draft={draft}
          onDraftChange={(value) => setPageDraft(page.id, value)}
          session={agent}
          onConfigureModel={onConfigureModel}
          onClarificationHover={setClarificationHighlight}
        />
      </div>
      <div className={mode === 'edit' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <PageEditor
          visible={active && mode === 'edit'}
          schemaRefreshKey={editorSchemaRefreshKey}
          ref={editorRef}
          editor={editor}
          projectId={projectId}
          pageId={page.id}
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
      </div>
      <div className={mode === 'preview' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <PagePreviewFrame
          active={active && mode === 'preview'}
          projectId={projectId}
          pageId={page.id}
          pageName={page.name}
          schemaRefreshKey={editorSchemaRefreshKey}
          theme={theme}
        />
      </div>
    </section>
  );
};
