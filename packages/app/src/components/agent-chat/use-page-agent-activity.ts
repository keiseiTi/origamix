import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgentRun, GetPageAgentActivityResponse } from '@origamix/shared';
import { getPageAgentActivity } from '@/services/agent';
import { subscribeBackendStatus } from '@/services/request';
import { isRunActive } from './agent-chat-state';

type ActivitySnapshot = Omit<GetPageAgentActivityResponse, 'version'>;

export const usePageAgentActivity = (projectId: string, pageId: string, active: boolean) => {
  const scope = useMemo(() => ({ projectId, pageId }), [projectId, pageId]);
  const transport = useRef<{
    scope: typeof scope;
    request: number;
    backendReady: boolean;
    pending: Promise<void> | null;
  } | null>(null);
  const [status, setStatus] = useState<{
    scope: typeof scope;
    snapshot: ActivitySnapshot | null;
    error: string | null;
  } | null>(null);
  const snapshot = status?.scope === scope ? status.snapshot : null;

  const refresh = useCallback(
    (force = false): Promise<void> => {
      const owned = transport.current;
      if (owned?.scope !== scope || !owned.backendReady) return Promise.resolve();
      if (!force && owned.pending) return owned.pending;
      const request = ++owned.request;
      const current = () => transport.current === owned && request === owned.request;
      const read = getPageAgentActivity(scope.projectId, scope.pageId)
        .then((next) => {
          if (!current()) return;
          setStatus((previousStatus) => {
            const previous = previousStatus?.scope === scope ? previousStatus.snapshot : null;
            if (
              previous &&
              previous.activeRun?.runId === next.activeRun?.runId &&
              previous.committedWorkingVersion === next.committedWorkingVersion
            )
              return previousStatus;
            return { scope, snapshot: next, error: null };
          });
        })
        .catch((error: unknown) => {
          if (current())
            setStatus({
              scope,
              snapshot: null,
              error: error instanceof Error ? error.message : '无法确认页面运行状态',
            });
        })
        .finally(() => {
          if (owned.pending === read) owned.pending = null;
        });
      owned.pending = read;
      return read;
    },
    [scope],
  );

  useEffect(() => {
    const owned = { scope, request: 0, backendReady: true, pending: null };
    transport.current = owned;
    const unsubscribe = subscribeBackendStatus((backendStatus) => {
      owned.request += 1;
      owned.backendReady = backendStatus !== 'restarting';
      setStatus({ scope, snapshot: null, error: null });
      if (backendStatus === 'ready') void refresh(true);
    });
    const initial = window.setTimeout(() => void refresh(), 0);
    return () => {
      transport.current = null;
      window.clearTimeout(initial);
      unsubscribe();
    };
  }, [refresh, scope]);

  useEffect(() => {
    if (!active) return;
    const checkVisiblePage = () => {
      if (document.visibilityState !== 'hidden') void refresh();
    };
    const renewed = window.setTimeout(checkVisiblePage, 0);
    const interval = window.setInterval(checkVisiblePage, 2500);
    window.addEventListener('focus', checkVisiblePage);
    document.addEventListener('visibilitychange', checkVisiblePage);
    return () => {
      window.clearTimeout(renewed);
      window.clearInterval(interval);
      window.removeEventListener('focus', checkVisiblePage);
      document.removeEventListener('visibilitychange', checkVisiblePage);
    };
  }, [active, refresh]);

  const acceptRun = useCallback(
    (run: AgentRun) => {
      const owned = transport.current;
      if (owned?.scope !== scope) return;
      owned.request += 1;
      owned.pending = null;
      setStatus((current) => {
        const previous = current?.scope === scope ? current.snapshot : null;
        const activeRun = isRunActive(run.status)
          ? { runId: run.runId, conversationId: run.conversationId }
          : previous?.activeRun?.runId !== run.runId
            ? (previous?.activeRun ?? null)
            : null;
        const committedWorkingVersion =
          Math.max(previous?.committedWorkingVersion ?? 0, run.resultWorkingVersion ?? 0) || null;
        return { scope, error: null, snapshot: { activeRun, committedWorkingVersion } };
      });
    },
    [scope],
  );

  const [commit, setCommit] = useState<{ scope: typeof scope; version: number } | null>(null);
  const observeCommit = useCallback(
    (version: number) =>
      setCommit((current) => ({
        scope,
        version: current?.scope === scope ? Math.max(current.version, version) : version,
      })),
    [scope],
  );

  return {
    observeCommit,
    committedWorkingVersion:
      Math.max(
        snapshot?.committedWorkingVersion ?? 0,
        commit?.scope === scope ? commit.version : 0,
      ) || null,
    snapshot,
    error: status?.scope === scope ? status.error : null,
    refresh,
    acceptRun,
  };
};
