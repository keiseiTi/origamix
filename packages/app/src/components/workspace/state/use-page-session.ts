import { useEffect, useRef, type RefObject } from 'react';
import { useAgentChat } from '@/components/agent-chat/use-agent-chat';
import type { EditorHandle } from '@/components/editor';
import { schemaService } from '@/services/schema';
import { usePageApplicationState } from './use-page-application-state';

export const derivePageCapabilities = ({
  agentActivity,
  applyStatus,
}: {
  agentActivity: 'unknown' | 'idle' | 'running';
  applyStatus: ReturnType<typeof usePageApplicationState>['applyStatus'];
}) => {
  const agentIdle = agentActivity === 'idle';
  return {
    canEdit: agentIdle,
    canApply:
      agentIdle && (applyStatus === 'saved_pending_apply' || applyStatus === 'result_pending'),
    canSaveVersion: agentIdle && applyStatus === 'draft_unsaved',
    canReload: agentIdle,
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
  const reconciliationRef = useRef<{ pageId: string; workingVersion: number } | null>(null);
  const reconcilingRunRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (agent.activity !== 'idle' || !agent.state.run) return;
    const runId = agent.state.run.runId;
    if (reconcilingRunRef.current === runId) return;
    reconcilingRunRef.current = runId;
    let disposed = false;
    void schemaService
      .workingState(projectId, pageId)
      .then((working) => {
        if (disposed) return;
        if (
          reconciliationRef.current?.pageId === pageId &&
          reconciliationRef.current.workingVersion === working.workingVersion
        )
          return;
        reconciliationRef.current = { pageId, workingVersion: working.workingVersion };
        const refreshKey = `working_authority_${runId}_${working.workingVersion}`;
        notifiedWorkingRef.current = { pageId, refreshKey };
        onSchemaCommitted(pageId, refreshKey);
      })
      .catch(() => {
        if (!disposed && reconcilingRunRef.current === runId) reconcilingRunRef.current = null;
      });
    return () => {
      disposed = true;
    };
  }, [agent.activity, agent.state.run, onSchemaCommitted, pageId, projectId]);

  return {
    application,
    agent,
    capabilities: derivePageCapabilities({
      agentActivity: agent.activity,
      applyStatus: application.applyStatus,
    }),
  };
};
