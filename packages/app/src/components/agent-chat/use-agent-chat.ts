import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { AgentEvent, AgentRun, CreateAgentRunRequest } from '@origamix/shared/protocol/agent';
import {
  cancelAgentRun,
  createAgentRun,
  getAgentRun,
  listConversations,
  listAllMessages,
  subscribeAgentEvents,
} from '../../services/agent';
import { pageOperationKey, usePendingOperations } from '../../store/pending-operations';
import { ApiRequestError } from '../../services/request';
import { schemaService } from '../../services/schema';
import { agentChatReducer, initialAgentChatState, isRunActive } from './agent-chat-state';

const requestId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export type AgentChatSession = {
  state: ReturnType<typeof agentChatReducer>;
  activity: 'unknown' | 'idle' | 'running';
  pendingSubmission: boolean;
  clarificationExpired: boolean;
  send: (text: string) => Promise<void>;
  selectClarification: (elementId: string) => Promise<void>;
  cancel: () => Promise<void>;
  retry: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const useAgentChat = (projectId: string, pageId: string): AgentChatSession => {
  const [state, dispatch] = useReducer(agentChatReducer, initialAgentChatState);
  const mounted = useRef(true);
  const generation = useRef(0);
  const sending = useRef(false);
  const authorityRequest = useRef(0);
  const lastSubmittedText = useRef('');
  const pageKey = pageOperationKey(projectId, pageId);
  const pending = usePendingOperations((value) => value.agents[pageKey]);
  const [authority, setAuthority] = useState<string | null>(null);
  const conversationId = useRef<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [latestWorkingVersion, setLatestWorkingVersion] = useState<number | null>(null);

  const loadAuthority = useCallback(async (): Promise<void> => {
    const currentGeneration = generation.current;
    const request = ++authorityRequest.current;
    const current = () =>
      mounted.current &&
      generation.current === currentGeneration &&
      authorityRequest.current === request;
    dispatch({ type: 'connection.changed', connection: 'recovering' });
    try {
      const listed = await listConversations(projectId, pageId);
      if (!current()) return;
      const conversation = listed.conversations[0];
      conversationId.current = conversation?.conversationId ?? null;
      if (!conversation) {
        setAuthority(pageKey);
        dispatch({ type: 'history.loaded', messages: [] });
        return;
      }
      const history = await listAllMessages(projectId, pageId, conversation.conversationId);
      const lastRunId = [...history.messages].reverse().find((message) => message.runId)?.runId;
      let run: AgentRun | null = null;
      if (lastRunId) run = (await getAgentRun(projectId, lastRunId)).run;
      if (current()) {
        setAuthority(pageKey);
        dispatch({ type: 'history.loaded', messages: history.messages, run });
      }
    } catch (error) {
      if (current())
        dispatch({
          type: 'history.failed',
          message: error instanceof Error ? error.message : '无法加载对话记录',
        });
    }
  }, [pageId, projectId, pageKey]);

  useEffect(() => {
    generation.current += 1;
    mounted.current = true;
    conversationId.current = null;
    dispatch({ type: 'reset' });
    // Cancel the initial load when StrictMode immediately disposes the mount.
    const initial = window.setTimeout(() => void loadAuthority(), 0);
    return () => {
      window.clearTimeout(initial);
      mounted.current = false;
      generation.current += 1;
    };
  }, [loadAuthority]);

  useEffect(
    () =>
      usePendingOperations.subscribe((next, previous) => {
        if (previous.agents[pageKey] && !next.agents[pageKey] && !sending.current) {
          // A request initiated by an unmounted view has settled. Recheck authority
          // before releasing the new view's editing lock.
          setAuthority(null);
          void loadAuthority();
        }
      }),
    [pageKey, loadAuthority],
  );

  const activeRunId = state.run && isRunActive(state.stage) ? state.run.runId : null;
  const clarification = state.run?.clarification;
  useEffect(() => {
    if (!clarification) return;
    let disposed = false;
    const refresh = () => {
      void schemaService
        .workingState(projectId, pageId)
        .then((working) => {
          if (!disposed) setLatestWorkingVersion(working.workingVersion);
        })
        .catch(() => undefined);
    };
    refresh();
    const timer = window.setInterval(refresh, 1_500);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [clarification, pageId, projectId]);
  useEffect(() => {
    if (!activeRunId) return;
    dispatch({ type: 'connection.changed', connection: 'connecting' });
    const afterEventId = state.lastEventId >= 0 ? state.lastEventId : undefined;
    const currentGeneration = generation.current;
    let disposed = false;
    let timer: number | undefined;
    const current = () => !disposed && mounted.current && generation.current === currentGeneration;
    const reconnect = () => {
      if (!current()) return;
      setAuthority(null);
      dispatch({ type: 'connection.changed', connection: 'recovering' });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (current())
          void loadAuthority().finally(() => {
            if (current()) setReconnectAttempt((value) => value + 1);
          });
      }, 750);
    };
    const unsubscribe = subscribeAgentEvents(projectId, activeRunId, {
      afterEventId,
      onEvent: (event: AgentEvent) => {
        if (!current()) return;
        dispatch({ type: 'event.received', event });
        if (
          event.type === 'run.completed' ||
          event.type === 'run.failed' ||
          event.type === 'run.cancelled' ||
          event.type === 'run.interrupted'
        ) {
          void loadAuthority();
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
    // Event ids are per Run. The current cursor is captured only when opening a stream;
    // received deltas must not tear down and recreate the same connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId, loadAuthority, projectId, reconnectAttempt]);

  const submit = useCallback(
    async (
      submission: {
        text: string;
        retryOfRunId?: string;
        clarification?: CreateAgentRunRequest['clarification'];
      },
      retryInput?: CreateAgentRunRequest,
    ): Promise<void> => {
      const content = submission.text.trim();
      const operations = usePendingOperations.getState();
      if (!content || sending.current || operations.agents[pageKey]?.inFlight)
        throw new Error('请求仍在处理中，请稍后重试');
      if (!retryInput && (authority !== pageKey || isRunActive(state.stage)))
        throw new Error('请等待页面运行状态确认后再发送');
      if (!retryInput && operations.agents[pageKey])
        throw new Error('上次发送结果待确认，请先重试');
      sending.current = true;
      dispatch({ type: 'submission.started' });
      authorityRequest.current += 1;
      const submissionAuthorityRequest = authorityRequest.current;
      setAuthority(null);
      lastSubmittedText.current = content;
      const currentGeneration = generation.current;
      const current = () => mounted.current && generation.current === currentGeneration;
      let input: CreateAgentRunRequest | undefined;
      let accepted = false;
      try {
        const working = retryInput
          ? undefined
          : await schemaService.workingState(projectId, pageId);
        const baseWorkingVersion = retryInput?.baseWorkingVersion ?? working!.workingVersion;
        if (!current()) throw new Error('页面已切换，请返回原页面重试');
        const latest = usePendingOperations.getState().agents[pageKey];
        if (latest?.inFlight || (!retryInput && latest))
          throw new Error('请求仍在处理中，请稍后重试');
        input = retryInput ?? {
          version: '1',
          projectId,
          pageId,
          ...(conversationId.current ? { conversationId: conversationId.current } : {}),
          clientRequestId: requestId(),
          baseWorkingVersion,
          content: { version: '1', blocks: [{ type: 'text', text: content }] },
          ...(submission.clarification ? { clarification: submission.clarification } : {}),
          ...(submission.retryOfRunId ? { retryOfRunId: submission.retryOfRunId } : {}),
        };
        operations.setAgent(pageKey, { input, inFlight: true });
        const created = await createAgentRun(input);
        accepted = true;
        operations.finishAgent(pageKey, input.clientRequestId, true);
        if (!current()) return;
        conversationId.current = created.conversationId;
        const run = (await getAgentRun(projectId, created.runId)).run;
        const history = await listAllMessages(projectId, pageId, created.conversationId);
        // A terminal SSE event may have started a newer authority reload while
        // this initial reconciliation was in flight. Never let this older
        // snapshot overwrite the persisted final assistant message.
        if (!current() || authorityRequest.current !== submissionAuthorityRequest) return;
        setAuthority(pageKey);
        dispatch({ type: 'history.loaded', messages: history.messages, run });
        // A fast provider may finish before the POST response has been reconciled.
        // Keep the durable resultWorkingVersion from history in that case; treating
        // a terminal Run as newly queued would clear the editor refresh signal and
        // there will be no active SSE subscription to restore it.
        if (isRunActive(run.status)) dispatch({ type: 'run.queued', run });
      } catch (error) {
        if (input && !accepted)
          operations.finishAgent(
            pageKey,
            input.clientRequestId,
            error instanceof ApiRequestError &&
              error.status >= 400 &&
              error.status < 500 &&
              error.status !== 408,
          );
        if (current()) {
          setAuthority(null);
          dispatch({
            type: 'history.failed',
            message: error instanceof Error ? error.message : '发送失败，请重试。',
          });
        }
        throw error;
      } finally {
        sending.current = false;
      }
    },
    [pageId, projectId, pageKey, authority, state.stage],
  );

  const send = useCallback((text: string) => submit({ text }), [submit]);

  const selectClarification = useCallback(
    async (elementId: string): Promise<void> => {
      const clarification = state.run?.clarification;
      const candidate = clarification?.candidates?.find((item) => item.elementId === elementId);
      if (!state.run || !clarification || !candidate) throw new Error('澄清选项不存在');
      const working = await schemaService.workingState(projectId, pageId);
      if (working.workingVersion !== clarification.baseWorkingVersion) {
        throw new Error('选项已过期，请重新描述你的需求');
      }
      await submit({
        text: `选择澄清项：${candidate.label}（元素 ${candidate.elementId}）`,
        clarification: {
          runId: state.run.runId,
          clarificationId: clarification.clarificationId,
          selectedElementId: candidate.elementId,
        },
      });
    },
    [pageId, projectId, state.run, submit],
  );

  const cancel = useCallback(async (): Promise<void> => {
    if (!state.run || !isRunActive(state.stage)) return;
    await cancelAgentRun(projectId, state.run.runId, requestId());
    await loadAuthority();
  }, [loadAuthority, projectId, state.run, state.stage]);

  const retry = useCallback(async (): Promise<void> => {
    const request = usePendingOperations.getState().agents[pageKey];
    if (request) {
      const text = request.input.content.blocks
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
      await submit({ text }, request.input);
    } else if (authority !== pageKey) await loadAuthority();
    else if (
      lastSubmittedText.current &&
      state.run &&
      ['failed', 'cancelled', 'interrupted'].includes(state.run.status)
    )
      await submit({ text: lastSubmittedText.current, retryOfRunId: state.run.runId });
    else await loadAuthority();
  }, [pageKey, authority, loadAuthority, state.run, submit]);

  const activity =
    authority !== pageKey || pending ? 'unknown' : isRunActive(state.stage) ? 'running' : 'idle';
  return {
    state,
    activity,
    pendingSubmission: Boolean(pending && !pending.inFlight),
    clarificationExpired: Boolean(
      clarification &&
      latestWorkingVersion !== null &&
      latestWorkingVersion !== clarification.baseWorkingVersion,
    ),
    send,
    selectClarification,
    cancel,
    retry,
    refresh: async () => {
      setAuthority(null);
      await loadAuthority();
    },
  };
};
