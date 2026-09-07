import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { AgentEvent, AgentRun } from '@origamix/shared/protocol/agent';
import {
  cancelAgentRun,
  createAgentRun,
  getAgentRun,
  listConversations,
  listAllMessages,
  subscribeAgentEvents,
} from '../services/agent';
import { schemaService } from '../services/schema';
import { agentChatReducer, initialAgentChatState, isRunActive } from './agent-chat-state';

const requestId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useAgentChat(
  projectId: string,
  pageId: string,
): {
  state: ReturnType<typeof agentChatReducer>;
  send: (text: string) => Promise<void>;
  cancel: () => Promise<void>;
  retry: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [state, dispatch] = useReducer(agentChatReducer, initialAgentChatState);
  const mounted = useRef(true);
  const generation = useRef(0);
  const sending = useRef(false);
  const lastSubmittedText = useRef('');
  const uncertainSubmission = useRef<{
    text: string;
    clientRequestId: string;
    baseRevisionId?: string;
    retryOfRunId?: string;
  } | null>(null);
  const conversationId = useRef<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const loadAuthority = useCallback(async (): Promise<void> => {
    const currentGeneration = generation.current;
    dispatch({ type: 'connection.changed', connection: 'recovering' });
    try {
      const listed = await listConversations(projectId, pageId);
      const conversation = listed.conversations[0];
      conversationId.current = conversation?.conversationId ?? null;
      if (!conversation) {
        dispatch({ type: 'history.loaded', messages: [] });
        return;
      }
      const history = await listAllMessages(projectId, pageId, conversation.conversationId);
      const lastRunId = [...history.messages].reverse().find((message) => message.runId)?.runId;
      let run: AgentRun | null = null;
      if (lastRunId) run = (await getAgentRun(projectId, lastRunId)).run;
      if (mounted.current && generation.current === currentGeneration)
        dispatch({ type: 'history.loaded', messages: history.messages, run });
    } catch (error) {
      if (mounted.current && generation.current === currentGeneration)
        dispatch({
          type: 'history.failed',
          message: error instanceof Error ? error.message : '无法加载对话记录',
        });
    }
  }, [pageId, projectId]);

  useEffect(() => {
    generation.current += 1;
    mounted.current = true;
    conversationId.current = null;
    dispatch({ type: 'reset' });
    void loadAuthority();
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, [loadAuthority]);

  const activeRunId = state.run && isRunActive(state.stage) ? state.run.runId : null;
  useEffect(() => {
    if (!activeRunId) return;
    dispatch({ type: 'connection.changed', connection: 'connecting' });
    const afterEventId = state.lastEventId >= 0 ? state.lastEventId : undefined;
    return subscribeAgentEvents(projectId, activeRunId, {
      afterEventId,
      onEvent: (event: AgentEvent) => dispatch({ type: 'event.received', event }),
      onError: () => {
        dispatch({ type: 'connection.changed', connection: 'recovering' });
        window.setTimeout(() => {
          if (mounted.current) {
            void loadAuthority().finally(() => setReconnectAttempt((current) => current + 1));
          }
        }, 750);
      },
      onClose: () => {
        void loadAuthority().finally(() => setReconnectAttempt((current) => current + 1));
      },
    });
    // Event ids are per Run. The current cursor is captured only when opening a stream;
    // received deltas must not tear down and recreate the same connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId, loadAuthority, projectId, reconnectAttempt]);

  const submit = useCallback(
    async (submission: {
      text: string;
      clientRequestId: string;
      baseRevisionId?: string;
      retryOfRunId?: string;
    }): Promise<void> => {
      const content = submission.text.trim();
      if (!content || sending.current || isRunActive(state.stage)) return;
      sending.current = true;
      lastSubmittedText.current = content;
      try {
        const baseRevisionId =
          submission.baseRevisionId ?? (await schemaService.get(projectId, pageId)).revisionId;
        const stableSubmission = { ...submission, text: content, baseRevisionId };
        uncertainSubmission.current = stableSubmission;
        const created = await createAgentRun({
          version: '1',
          projectId,
          pageId,
          ...(conversationId.current ? { conversationId: conversationId.current } : {}),
          clientRequestId: stableSubmission.clientRequestId,
          baseRevisionId,
          content: { version: '1', blocks: [{ type: 'text', text: content }] },
          ...(stableSubmission.retryOfRunId ? { retryOfRunId: stableSubmission.retryOfRunId } : {}),
        });
        conversationId.current = created.conversationId;
        const run = (await getAgentRun(projectId, created.runId)).run;
        const history = await listAllMessages(projectId, pageId, created.conversationId);
        dispatch({ type: 'history.loaded', messages: history.messages, run });
        dispatch({ type: 'run.queued', run });
        uncertainSubmission.current = null;
      } catch (error) {
        dispatch({
          type: 'history.failed',
          message: error instanceof Error ? error.message : '发送失败，请重试。',
        });
        throw error;
      } finally {
        sending.current = false;
      }
    },
    [pageId, projectId, state.stage],
  );

  const send = useCallback(
    (text: string) => submit({ text, clientRequestId: requestId() }),
    [submit],
  );

  const cancel = useCallback(async (): Promise<void> => {
    if (!state.run || !isRunActive(state.stage)) return;
    await cancelAgentRun(projectId, state.run.runId, requestId());
    await loadAuthority();
  }, [loadAuthority, projectId, state.run, state.stage]);

  const retry = useCallback(async (): Promise<void> => {
    if (uncertainSubmission.current) await submit(uncertainSubmission.current);
    else if (lastSubmittedText.current)
      await submit({
        text: lastSubmittedText.current,
        clientRequestId: requestId(),
        ...(state.run ? { retryOfRunId: state.run.runId } : {}),
      });
    else await loadAuthority();
  }, [loadAuthority, state.run, submit]);

  return { state, send, cancel, retry, refresh: loadAuthority };
}
