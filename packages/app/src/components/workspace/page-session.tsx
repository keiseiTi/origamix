import type { AgentUsageScope } from '@origamix/shared';
import { PageUsage } from '@/components/usage/page-usage';
import { workbenchHost } from '@/utils';
import { ErrorToast } from '@/components/error-toast';
import { useEffect, useImperativeHandle, useState, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { usePreferencesStore } from '@/store/preferences';
import { useWorkspaceStore, type PageItem } from '@/store/workspace';
import { ChatWorkspace } from '@/components/agent-chat';
import { isRunActive } from '@/components/agent-chat/agent-chat-state';
import { PageEditor } from '@/components/editor';
import { useCreateEditor } from '@origamix/editor';
import { AgentChatToolbar } from './agent-chat-toolbar';
import { createWorkspaceToolbarPlugin } from './workspace-toolbar-plugin';
import { usePageSession } from './hooks/use-page-session';
import { PagePreviewFrame } from './preview/page-preview-frame';

const workspaceToolbarPlugin = createWorkspaceToolbarPlugin();

export interface PageSessionProps {
  active?: boolean;
  pageId: string;
  editorRef: RefObject<{ flush: () => Promise<void> } | null>;
  onOpenUsage?: (scope: AgentUsageScope) => void;
  onConfigureModel?: () => void;
}

export const PageSession = ({
  active = true,
  pageId,
  editorRef,
  onConfigureModel,
  onOpenUsage,
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
      onOpenUsage={onOpenUsage}
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
  onOpenUsage,
}: Omit<PageSessionProps, 'pageId'> & {
  page: PageItem;
  projectId: string;
  projectName: string;
}): React.JSX.Element => {
  const isWeb = workbenchHost() === 'web';
  const mode = useWorkspaceStore(
    (state) => state.openPages.find((tab) => tab.id === page.id)?.mode ?? 'chat',
  );
  const theme = usePreferencesStore((state) => state.theme);
  const [interactionError, setInteractionError] = useState<Error | null>(null);
  const [clarificationHighlight, setClarificationHighlight] = useState<string | null>(null);

  const { working, materials, pageApply, agent, capabilities, externalWorkingChange } =
    usePageSession({
      projectId,
      pageId: page.id,
      isWeb,
      active,
      editing: active && mode === 'edit',
    });
  const draft = useWorkspaceStore(
    (state) => state.conversationDrafts[page.id]?.[agent.conversationId ?? ''] ?? '',
  );
  const setConversationDraft = useWorkspaceStore((state) => state.setConversationDraft);
  const selectConversation = (id: string | null) => {
    if (!agent.selectConversation(id)) return false;
    setClarificationHighlight(null);
    return true;
  };

  const setPageStatus = useWorkspaceStore((state) => state.setPageStatus);
  useImperativeHandle(editorRef, () => ({ flush: working.flush }), [working.flush]);

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
    applyStatus: pageApply.applyStatus,
    canApply: capabilities.canApply,
    isWeb,
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
    beforeModeChange: working.flush,
  });

  return (
    <section className='relative flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950'>
      <div className={mode === 'chat' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <AgentChatToolbar
          {...toolbarProps}
          agent={{ ...agent, selectConversation }}
          active={active && mode === 'chat'}
        />
        <ChatWorkspace
          pageId={page.id}
          pageName={page.name}
          draft={draft}
          onDraftChange={(value) => setConversationDraft(page.id, agent.conversationId, value)}
          session={agent}
          applyStatus={pageApply.applyStatus}
          onConfigureModel={onConfigureModel}
          onClarificationHover={setClarificationHighlight}
          composerFooter={
            active &&
            mode === 'chat' &&
            onOpenUsage && (
              <PageUsage
                key={`${projectId}:${page.id}`}
                projectId={projectId}
                pageId={page.id}
                runId={agent.state.run?.runId}
                runStatus={
                  isRunActive(agent.state.stage) ? 'active' : (agent.state.stage ?? undefined)
                }
                onOpenUsage={onOpenUsage}
              />
            )
          }
        />
      </div>
      <div className={mode === 'edit' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        {active && mode === 'edit' && <ErrorToast message={interactionError?.message} />}
        <PageEditor
          visible={active && mode === 'edit'}
          working={working}
          materials={materials}
          editor={editor}
          projectId={projectId}
          pageId={page.id}
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
            disabled: agent.clarificationExpired || !agent.canSend,
            onSelect: (elementId) =>
              void agent.selectClarification(elementId).catch(setInteractionError),
          }}
        />
      </div>
      <div className={mode === 'preview' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        <PagePreviewFrame
          active={active && mode === 'preview'}
          projectId={projectId}
          pageId={page.id}
          pageName={page.name}
          externalWorkingChange={externalWorkingChange}
          theme={theme}
          repairAgent={{
            activity: agent.activity,
            run: agent.state.run,
            messages: agent.state.messages,
            submit: agent.repair,
          }}
        />
      </div>
    </section>
  );
};
