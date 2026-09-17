import { useEffect, useRef, type RefObject } from 'react';
import { useAgentChat } from '../../agent-chat/use-agent-chat';
import type { EditorHandle } from '../../editor';
import { usePageApplicationState } from './use-page-application-state';

export const derivePageCapabilities = ({
  agentActivity,
  applyStatus,
  saveStatus,
}: {
  agentActivity: 'unknown' | 'idle' | 'running';
  applyStatus: ReturnType<typeof usePageApplicationState>['applyStatus'];
  saveStatus: ReturnType<typeof usePageApplicationState>['saveStatus'];
}) => {
  const agentIdle = agentActivity === 'idle';
  return {
    canEdit: agentIdle,
    canUndo: agentIdle && applyStatus !== 'draft_unsaved',
    canApply:
      agentIdle &&
      saveStatus === 'saved' &&
      (applyStatus === 'saved_pending_apply' || applyStatus === 'result_pending'),
    canSaveVersion: agentIdle && saveStatus === 'saved' && applyStatus === 'draft_unsaved',
    canReload: agentIdle,
    canLeave: agentIdle && saveStatus === 'saved',
    agentChecking: agentActivity === 'unknown',
  };
};

export const usePageSession = ({
  projectId,
  pageId,
  schemaRefreshKey,
  editorRef,
  onSchemaCommitted,
}: {
  projectId: string;
  pageId: string;
  schemaRefreshKey: string;
  editorRef: RefObject<EditorHandle | null>;
  onSchemaCommitted: (pageId: string, revisionId: string) => void;
}) => {
  const application = usePageApplicationState({
    projectId,
    pageId,
    schemaRefreshKey,
    editorRef,
    onSchemaCommitted,
  });
  const agent = useAgentChat(projectId, pageId);
  const notifiedRevisionRef = useRef<{ pageId: string; revisionId: string } | null>(null);

  useEffect(() => {
    const revisionId = agent.state.committedRevisionId;
    if (
      !revisionId ||
      (notifiedRevisionRef.current?.pageId === pageId &&
        notifiedRevisionRef.current.revisionId === revisionId)
    )
      return;
    notifiedRevisionRef.current = { pageId, revisionId };
    onSchemaCommitted(pageId, revisionId);
  }, [agent.state.committedRevisionId, onSchemaCommitted, pageId]);

  return {
    application,
    agent,
    capabilities: derivePageCapabilities({
      agentActivity: agent.activity,
      applyStatus: application.applyStatus,
      saveStatus: application.saveStatus,
    }),
  };
};
