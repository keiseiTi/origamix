import { useEffect, useEffectEvent, useState, type Dispatch } from 'react';
import type { AgentEvent } from '@origamix/shared';
import { subscribeAgentEvents } from '@/services/agent';
import type { AgentChatAction } from './agent-chat-state';

const terminalEvents = new Set(['run.completed', 'run.failed', 'run.cancelled', 'run.interrupted']);

export const useAgentEvents = ({
  projectId,
  pageId,
  runId,
  lastEventId,
  dispatch,
  reconcile,
  onWorkingCommitted,
}: {
  projectId: string;
  pageId: string;
  runId: string | null;
  lastEventId: number;
  dispatch: Dispatch<AgentChatAction>;
  reconcile: (terminal: boolean) => Promise<void>;
  onWorkingCommitted: (version: number) => void;
}) => {
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const cursor = useEffectEvent(() => lastEventId);
  const recheck = useEffectEvent(reconcile);

  useEffect(() => {
    if (!runId) return;
    dispatch({ type: 'connection.changed', connection: 'connecting' });
    let disposed = false;
    let terminalReceived = false;
    let timer: number | undefined;
    const reconnect = () => {
      if (disposed || terminalReceived) return;
      dispatch({ type: 'connection.changed', connection: 'recovering' });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (disposed) return;
        void recheck(false).finally(() => {
          if (!disposed) setReconnectAttempt((value) => value + 1);
        });
      }, 750);
    };
    const last = cursor();
    const unsubscribe = subscribeAgentEvents(projectId, runId, {
      afterEventId: last >= 0 ? last : undefined,
      onOpen: () => {
        if (!disposed) dispatch({ type: 'connection.changed', connection: 'connected' });
      },
      onEvent: (event: AgentEvent) => {
        if (
          disposed ||
          event.runId !== runId ||
          event.pageId !== pageId ||
          (event.target && (event.target.projectId !== projectId || event.target.pageId !== pageId))
        )
          return;
        dispatch({ type: 'event.received', event });
        if (event.type === 'working.committed' || event.type === 'run.completed') {
          const payload = event.payload as { resultWorkingVersion?: unknown };
          if (typeof payload.resultWorkingVersion === 'number')
            onWorkingCommitted(payload.resultWorkingVersion);
        }
        if (terminalEvents.has(event.type)) {
          terminalReceived = true;
          void recheck(true);
        }
      },
      onError: reconnect,
      onClose: reconnect,
    });
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [dispatch, onWorkingCommitted, pageId, projectId, reconnectAttempt, runId]);
};
