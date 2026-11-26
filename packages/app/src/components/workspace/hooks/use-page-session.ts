import { useCallback, useState } from 'react';
import { useAgentChat } from '@/components/agent-chat/use-agent-chat';
import { useEditorSession } from '@/components/editor/use-editor-session';
import { useEditorMaterials } from '@/materials/use-editor-materials';
import { usePageApplyState } from './use-page-apply-state';

export const derivePageCapabilities = ({
  agentActivity,
  applyStatus,
}: {
  agentActivity: 'unknown' | 'idle' | 'running';
  applyStatus: ReturnType<typeof usePageApplyState>['applyStatus'];
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
  active,
  editing,
  isWeb,
}: {
  projectId: string;
  pageId: string;
  active: boolean;
  editing: boolean;
  isWeb: boolean;
}) => {
  const materials = useEditorMaterials(projectId, editing);
  const [refresh, setRefresh] = useState<{
    signal: number | symbol | null;
    agentVersion: number | null;
  }>({ signal: null, agentVersion: null });
  const [observedWorkingVersion, setObservedWorkingVersion] = useState(0);
  const [visualWorkingVersion, setVisualWorkingVersion] = useState(0);
  const observeWorking = useCallback(
    (version: number) => setObservedWorkingVersion((current) => Math.max(current, version)),
    [],
  );
  const confirmedWorkingVersion = Math.max(
    observedWorkingVersion,
    visualWorkingVersion,
    refresh.agentVersion ?? 0,
    typeof refresh.signal === 'number' ? refresh.signal : 0,
  );
  const agent = useAgentChat(projectId, pageId, {
    active,
    workingVersion: confirmedWorkingVersion || undefined,
  });
  const agentVersion = agent.committedWorkingVersion;
  // Consume an Agent commit in the same render that unlocks the editor.
  // A later non-writing Run must not invalidate the loaded schema.
  if (agentVersion !== null && agentVersion > (refresh.agentVersion ?? 0))
    setRefresh({
      signal:
        typeof refresh.signal === 'number' ? Math.max(refresh.signal, agentVersion) : agentVersion,
      agentVersion,
    });

  const working = useEditorSession(
    projectId,
    pageId,
    agent.activity !== 'idle',
    setVisualWorkingVersion,
    editing && Boolean(materials.registration),
    refresh.signal,
  );
  const pageApply = usePageApplyState({
    projectId,
    pageId,
    externalWorkingChange: refresh.signal,
    visualWorkingVersion,
    active,
    isWeb,
    working,
    onWorkingObserved: observeWorking,
    onSchemaCommitted: (signal) => setRefresh((current) => ({ ...current, signal })),
  });

  return {
    working,
    materials,
    pageApply,
    agent,
    externalWorkingChange: refresh.signal,
    capabilities: derivePageCapabilities({
      agentActivity: agent.activity,
      applyStatus: pageApply.applyStatus,
    }),
  };
};
