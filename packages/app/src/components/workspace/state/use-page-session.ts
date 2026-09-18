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
  active = true,
  editorRef,
  onSchemaCommitted,
}: {
  projectId: string;
  pageId: string;
  schemaRefreshKey: string;
  active?: boolean;
  editorRef: RefObject<EditorHandle | null>;
  onSchemaCommitted: (pageId: string, revisionId: string) => void;
}) => {
  const application = usePageApplicationState({
    projectId,
    pageId,
    schemaRefreshKey,
    active,
    editorRef,
    onSchemaCommitted,
  });
  const agent = useAgentChat(projectId, pageId);
  const notifiedWorkingRef = useRef<{ pageId: string; refreshKey: string } | null>(null);

  useEffect(() => {
    const refreshKey = agent.state.workingRefreshKey;
    if (
      !refreshKey ||
      (notifiedWorkingRef.current?.pageId === pageId &&
        notifiedWorkingRef.current.refreshKey === refreshKey)
    )
      return;
    notifiedWorkingRef.current = { pageId, refreshKey };
    onSchemaCommitted(pageId, refreshKey);
  }, [agent.state.workingRefreshKey, onSchemaCommitted, pageId]);

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
