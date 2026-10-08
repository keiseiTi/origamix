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
  const [liveRunId, setLiveRunId] = useState<string | null>(null);
  const pageKey = pageOperationKey(projectId, pageId);
  const pending = usePendingOperations((value) => value.agents[pageKey]);
  const preparing = usePendingOperations((value) => value.agentPreparations[pageKey]);
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
        if (run && !isRunActive(run.status)) setLiveRunId(null);
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
        if (
          !sending.current &&
          !next.agents[pageKey] &&
          !next.agentPreparations[pageKey] &&
          (previous.agents[pageKey] || previous.agentPreparations[pageKey])
        ) {
          // A request initiated by an unmounted view has settled. Recheck authority
          // before releasing the new view's editing lock.
          setAuthority(null);
          void loadAuthority();
        }
      }),
    [pageKey, loadAuthority],
  );

  const activeRunId =
    state.run &&
    (isRunActive(state.stage) || (liveRunId === state.run.runId && !state.terminalEventSeen))
      ? state.run.runId
      : null;
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
    return () => {
      disposed = true;
    };
  }, [clarification, pageId, projectId]);
  useEffect(() => {
    if (!activeRunId) return;
    dispatch({ type: 'connection.changed', connection: 'connecting' });
    const afterEventId = state.lastEventId >= 0 ? state.lastEventId : undefined;
    const currentGeneration = generation.current;
    let disposed = false;
    let terminalReceived = false;
    let timer: number | undefined;
    const current = () => !disposed && mounted.current && generation.current === currentGeneration;
    const reconnect = () => {
      if (!current()) return;
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
      onOpen: () => {
        if (current()) dispatch({ type: 'connection.changed', connection: 'connected' });
      },
      onEvent: (event: AgentEvent) => {
        if (!current()) return;
        dispatch({ type: 'event.received', event });
        if (
          event.type === 'run.completed' ||
          event.type === 'run.failed' ||
          event.type === 'run.cancelled' ||
          event.type === 'run.interrupted'
        ) {
          terminalReceived = true;
          setAuthority(null);
          void loadAuthority();
        }
      },
      onError: () => {
        if (!terminalReceived) reconnect();
      },
      onClose: () => {
        if (!terminalReceived) reconnect();
      },
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
      if (
        !content ||
        sending.current ||
        operations.agents[pageKey]?.inFlight ||
        operations.agentPreparations[pageKey]
      )
        throw new Error('请求仍在处理中，请稍后重试');
      if (!retryInput && (authority !== pageKey || isRunActive(state.stage)))
        throw new Error('请等待页面运行状态确认后再发送');
      if (!retryInput && operations.agents[pageKey])
        throw new Error('上次发送结果待确认，请先重试');
      const preparationId = retryInput ? null : requestId();
      if (preparationId && !operations.reserveAgent(pageKey, preparationId))
        throw new Error('请求仍在处理中，请稍后重试');
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
        if (preparationId) operations.finishAgentPreparation(pageKey, preparationId);
        const created = await createAgentRun(input);
        accepted = true;
        operations.finishAgent(pageKey, input.clientRequestId, true);
        if (!current()) return;
        conversationId.current = created.conversationId;
        const replayEvents = isRunActive(created.status);
        if (replayEvents) setLiveRunId(created.runId);
        // A renderer can briefly outlive an older desktop Server during a dev
        // rebuild. Recover the Run snapshot instead of silently skipping SSE.
        const run = created.run ?? (await getAgentRun(projectId, created.runId)).run;
        if (!current()) return;
        // The create response includes the Run snapshot, so subscribe before
        // loading message history or making another authority request.
        if (replayEvents) dispatch({ type: 'run.queued', run });
        const history = await listAllMessages(projectId, pageId, created.conversationId);
        // A terminal SSE event may have started a newer authority reload while
        // this initial reconciliation was in flight. Never let this older
        // snapshot overwrite the persisted final assistant message.
        if (!current() || authorityRequest.current !== submissionAuthorityRequest) return;
        setAuthority(pageKey);
        dispatch({
          type: 'history.loaded',
          messages: replayEvents
            ? history.messages.filter(
                (message) => message.runId !== created.runId || message.role !== 'assistant',
              )
            : history.messages,
          run,
          preserveStream: replayEvents,
        });
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
            message: accepted
              ? '请求已提交，正在恢复对话状态。'
              : error instanceof Error
                ? error.message
                : '发送失败，请重试。',
          });
          if (accepted) void loadAuthority();
        }
        if (accepted) return;
        throw error;
      } finally {
        if (preparationId) operations.finishAgentPreparation(pageKey, preparationId);
        sending.current = false;
      }
    },
    [pageId, projectId, pageKey, authority, state.stage, loadAuthority],
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
    authority !== pageKey || pending || preparing
      ? 'unknown'
      : isRunActive(state.stage)
        ? 'running'
        : 'idle';
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
