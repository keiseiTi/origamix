import type { AgentRun, CreateAgentRunRequest, RuntimeRepairEvidence } from '@origamix/shared';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { cancelAgentRun, createAgentRun, getAgentRun, listConversations } from '@/services/agent';
import { pageOperationKey, usePendingOperations } from '@/store/pending-operations';
import { isMutationRejected, subscribeBackendStatus } from '@/services/request';
import { schemaService } from '@/services/schema';
import { agentChatReducer, initialAgentChatState, isRunActive } from './agent-chat-state';
import { uniqueId } from '@/utils';
import { useWorkspaceStore } from '@/store/workspace';
import { useConversationMessages } from './use-conversation-messages';
import { usePageAgentActivity } from './use-page-agent-activity';
import { useAgentEvents } from './use-agent-events';

const requestId = (): string => uniqueId();

export type AgentChatSession = {
  state: ReturnType<typeof agentChatReducer>;
  activity: 'unknown' | 'idle' | 'running';
  pendingSubmission: boolean;
  canSend: boolean;
  committedWorkingVersion: number | null;
  hasOlderMessages: boolean;
  loadingOlderMessages: boolean;
  loadOlderMessages: () => Promise<void>;
  conversationId: string | null;
  selectConversation: (id: string | null) => boolean;
  clarificationExpired: boolean;
  send: (text: string) => Promise<void>;
  selectClarification: (elementId: string) => Promise<void>;
  cancel: () => Promise<void>;
  retry: () => Promise<void>;
  refresh: () => Promise<void>;
};

export const useAgentChat = (
  projectId: string,
  pageId: string,
  { active = true, workingVersion }: { active?: boolean; workingVersion?: number } = {},
): AgentChatSession & {
  repair: (evidence: RuntimeRepairEvidence, workingVersion: number) => Promise<void>;
} => {
  const [state, dispatch] = useReducer(agentChatReducer, initialAgentChatState);
  const sessionToken = useRef<symbol | null>(null);
  const sending = useRef(false);
  const authorityRequest = useRef(0);
  const lastSubmission = useRef<{ runId: string; text: string; repair: boolean } | null>(null);
  const pageKey = pageOperationKey(projectId, pageId);
  const pending = usePendingOperations((value) => value.agents[pageKey]);
  const preparing = usePendingOperations((value) => value.agentPreparations[pageKey]);
  const pageActivity = usePageAgentActivity(projectId, pageId, active);
  const { refresh: refreshPageActivity, acceptRun } = pageActivity;
  const [historyReady, setHistoryReady] = useState<string | null>(null);
  // Undefined selects the latest conversation. Null is an explicit empty conversation.
  const selection = useRef<string | null | undefined>(undefined);
  const [conversationId, setConversationId] = useState<string | null>(null);
  // A page tab owns its Hook instance. This token also expires callbacks from
  // an earlier effect lifecycle, including a StrictMode cleanup and setup.
  const captureSession = useCallback(() => {
    const token = sessionToken.current;
    return () => token !== null && sessionToken.current === token;
  }, []);

  const {
    readMessages,
    retainMessages,
    clearMessages,
    loadOlderMessages,
    hasOlderMessages,
    loadingOlderMessages,
  } = useConversationMessages(projectId, pageId, captureSession, dispatch);

  const loadAuthority = useCallback(async (): Promise<void> => {
    const isSessionCurrent = captureSession();
    if (!isSessionCurrent()) return;
    const request = ++authorityRequest.current;
    const isAuthorityCurrent = () => isSessionCurrent() && authorityRequest.current === request;
    dispatch({ type: 'connection.changed', connection: 'recovering' });
    try {
      let selected = selection.current;
      if (selected === undefined) {
        const listed = await listConversations(projectId, pageId);
        if (!isAuthorityCurrent()) return;
        selected = listed.conversations[0]?.conversationId ?? null;
      }
      if (!selected) {
        selection.current = null;
        setConversationId(null);
        setHistoryReady(pageKey);
        dispatch({ type: 'history.loaded', messages: [] });
        return;
      }
      const history = await readMessages(selected, isAuthorityCurrent);
      if (!isAuthorityCurrent()) return;
      const lastRunId = [...history.messages].reverse().find((message) => message.runId)?.runId;
      let run: AgentRun | null = null;
      if (lastRunId) run = (await getAgentRun(projectId, lastRunId)).run;
      if (isAuthorityCurrent()) {
        selection.current = selected;
        setConversationId(selected);
        setHistoryReady(pageKey);
        dispatch({ type: 'history.loaded', messages: retainMessages(history), run });
      }
    } catch (error) {
      if (isAuthorityCurrent()) {
        setHistoryReady(null);
        dispatch({
          type: 'history.failed',
          message: error instanceof Error ? error.message : '无法加载对话记录',
        });
      }
    }
  }, [projectId, pageId, pageKey, captureSession, readMessages, retainMessages]);

  useEffect(() => {
    sessionToken.current = Symbol();
    selection.current = undefined;
    lastSubmission.current = null;
    // Cancel the initial load when StrictMode immediately disposes the mount.
    const initial = window.setTimeout(() => {
      setConversationId(null);
      setHistoryReady(null);
      clearMessages();
      dispatch({ type: 'reset' });
      void loadAuthority();
    }, 0);
    return () => {
      window.clearTimeout(initial);
      sessionToken.current = null;
    };
  }, [clearMessages, loadAuthority]);

  useEffect(
    () =>
      subscribeBackendStatus((status) => {
        setHistoryReady(null);
        authorityRequest.current += 1;
        if (status === 'ready') void loadAuthority();
        else dispatch({ type: 'connection.changed', connection: 'recovering' });
      }),
    [loadAuthority],
  );

  useEffect(
    () =>
      usePendingOperations.subscribe((next, previous) => {
        if (
          !sending.current &&
          !next.agents[pageKey] &&
          !next.agentPreparations[pageKey] &&
          (previous.agents[pageKey] || previous.agentPreparations[pageKey])
        ) {
          // A request initiated by an unmounted view has settled. Recheck the backend
          // before releasing the new view's editing lock.
          selection.current = undefined;
          clearMessages();
          setHistoryReady(null);
          void Promise.all([loadAuthority(), refreshPageActivity()]);
        }
      }),
    [clearMessages, pageKey, loadAuthority, refreshPageActivity],
  );

  const activeRunId = state.run && isRunActive(state.stage) ? state.run.runId : null;
  const clarification = state.run?.clarification;

  useAgentEvents({
    projectId,
    pageId,
    runId: activeRunId,
    lastEventId: state.lastEventId,
    onWorkingCommitted: pageActivity.observeCommit,
    dispatch,
    reconcile: async (terminal) => {
      if (terminal) setHistoryReady(null);
      await Promise.all([loadAuthority(), refreshPageActivity(true)]);
    },
  });

  const observedRunId = pageActivity.snapshot?.activeRun?.runId;
  const observedConversationId = pageActivity.snapshot?.activeRun?.conversationId;
  const selectedRunId = state.run?.runId;
  useEffect(() => {
    if (
      !sending.current &&
      conversationId &&
      conversationId === observedConversationId &&
      observedRunId !== selectedRunId
    )
      void loadAuthority();
  }, [conversationId, observedRunId, observedConversationId, selectedRunId, loadAuthority]);

  const pageRun = pageActivity.snapshot?.activeRun ?? null;
  const activity =
    !pageActivity.snapshot || pending || preparing
      ? 'unknown'
      : pageRun || activeRunId
        ? 'running'
        : 'idle';
  const canSend = activity === 'idle' && historyReady === pageKey;

  const submit = useCallback(
    async (
      submission: {
        text: string;
        retryOfRunId?: string;
        repair?: { evidence: RuntimeRepairEvidence; workingVersion: number };
        clarification?: CreateAgentRunRequest['clarification'];
      },
      retryInput?: CreateAgentRunRequest,
    ): Promise<void> => {
      const content = submission.text.trim();
      const isRepair =
        Boolean(submission.repair) ||
        (retryInput?.content.blocks.some((block) => block.type === 'runtime_repair') ?? false);
      const operations = usePendingOperations.getState();
      if (
        !content ||
        sending.current ||
        operations.agents[pageKey]?.inFlight ||
        operations.agentPreparations[pageKey]
      )
        throw new Error('请求仍在处理中，请稍后重试');
      if (!retryInput && !canSend) throw new Error('请等待页面运行状态确认后再发送');
      if (!retryInput && operations.agents[pageKey])
        throw new Error('上次发送结果待确认，请先重试');
      const preparationId = retryInput ? null : requestId();
      if (preparationId && !operations.reserveAgent(pageKey, preparationId))
        throw new Error('请求仍在处理中，请稍后重试');
      sending.current = true;
      dispatch({ type: 'submission.started' });
      authorityRequest.current += 1;
      const submissionAuthorityRequest = authorityRequest.current;
      setHistoryReady(null);
      const isSessionCurrent = captureSession();
      const intendedConversation = selection.current;
      let input: CreateAgentRunRequest | undefined;
      let accepted = false;
      try {
        let baseWorkingVersion = retryInput?.baseWorkingVersion;
        if (baseWorkingVersion === undefined) {
          const working = await schemaService.workingState(projectId, pageId);
          baseWorkingVersion = working.workingVersion;
          if (
            submission.repair &&
            (working.workingVersion !== submission.repair.workingVersion ||
              working.workingHash !== submission.repair.evidence.workingHash)
          )
            throw new Error('预览已过期，请刷新后重现故障。');
        }
        const latest = usePendingOperations.getState().agents[pageKey];
        if (latest?.inFlight || (!retryInput && latest))
          throw new Error('请求仍在处理中，请稍后重试');
        input = retryInput ?? {
          version: '1',
          projectId,
          pageId,
          target: { kind: 'page' as const, projectId, pageId },
          ...(intendedConversation ? { conversationId: intendedConversation } : {}),
          clientRequestId: requestId(),
          baseWorkingVersion,
          content: {
            version: '1',
            blocks: [
              { type: 'text', text: content },
              ...(submission.repair ? [submission.repair.evidence] : []),
            ],
          },
          ...(submission.clarification ? { clarification: submission.clarification } : {}),
          ...(submission.retryOfRunId ? { retryOfRunId: submission.retryOfRunId } : {}),
        };
        operations.setAgent(pageKey, { input, inFlight: true });
        if (preparationId) operations.finishAgentPreparation(pageKey, preparationId);
        const created = await createAgentRun(input);
        accepted = true;
        operations.finishAgent(pageKey, input.clientRequestId, true);
        if (!isSessionCurrent()) return;
        lastSubmission.current = {
          runId: created.runId,
          text: content,
          repair: isRepair,
        };
        useWorkspaceStore
          .getState()
          .settleConversationDraft(
            pageId,
            input.conversationId ?? null,
            created.conversationId,
            !isRepair && !input.clarification && !input.retryOfRunId ? content : undefined,
          );
        selection.current = created.conversationId;
        setConversationId(created.conversationId);
        acceptRun({ ...created.run, conversationId: created.conversationId });
        const replayEvents = isRunActive(created.status);
        // The create response includes the Run snapshot, so subscribe before
        // loading message history or making another backend state request.
        const { run } = created;
        if (replayEvents) dispatch({ type: 'run.queued', run });
        const isSubmissionCurrent = () =>
          isSessionCurrent() && authorityRequest.current === submissionAuthorityRequest;
        const history = await readMessages(created.conversationId, isSubmissionCurrent);
        // A terminal SSE event may have started a newer backend state reload while
        // this initial reconciliation was in flight. Never let this older
        // snapshot overwrite the persisted final assistant message.
        if (!isSubmissionCurrent()) return;
        const reconciled = retainMessages(history);
        setHistoryReady(pageKey);
        dispatch({
          type: 'history.loaded',
          messages: replayEvents
            ? reconciled.filter(
                (message) => message.runId !== created.runId || message.role !== 'assistant',
              )
            : reconciled,
          run,
          preserveStream: replayEvents,
        });
      } catch (error) {
        const rejected = !input || isMutationRejected(error);
        if (input && !accepted) operations.finishAgent(pageKey, input.clientRequestId, rejected);
        if (isSessionCurrent() && authorityRequest.current === submissionAuthorityRequest) {
          setHistoryReady(null);
          dispatch({
            type: 'history.failed',
            message: accepted
              ? '请求已提交，正在恢复对话状态。'
              : error instanceof Error
                ? error.message
                : '发送失败，请重试。',
          });
          if (accepted || (isRepair && rejected)) void loadAuthority();
          if (rejected) void refreshPageActivity(true);
        }
        if (accepted) return;
        throw error;
      } finally {
        if (preparationId) operations.finishAgentPreparation(pageKey, preparationId);
        sending.current = false;
      }
    },
    [
      acceptRun,
      pageId,
      projectId,
      pageKey,
      canSend,
      loadAuthority,
      captureSession,
      readMessages,
      refreshPageActivity,
      retainMessages,
    ],
  );

  const send = useCallback((text: string) => submit({ text }), [submit]);

  const [rejectedClarification, setRejectedClarification] = useState<string | null>(null);
  const selectClarification = useCallback(
    async (elementId: string): Promise<void> => {
      const clarification = state.run?.clarification;
      const candidate = clarification?.candidates?.find((item) => item.elementId === elementId);
      if (!state.run || !clarification || !candidate) throw new Error('澄清选项不存在');
      const authority = authorityRequest.current;
      const isSessionCurrent = captureSession();
      const working = await schemaService.workingState(projectId, pageId);
      if (!isSessionCurrent() || authority !== authorityRequest.current) return;
      if (working.workingVersion !== clarification.baseWorkingVersion) {
        setRejectedClarification(clarification.clarificationId);
        throw new Error('选项已过期，请重新描述你的需求');
      }
      await submit({
        text: `选择澄清项：${candidate.label}`,
        clarification: {
          runId: state.run.runId,
          clarificationId: clarification.clarificationId,
          selectedElementId: candidate.elementId,
        },
      });
    },
    [pageId, projectId, state.run, submit, captureSession],
  );

  const cancel = useCallback(async (): Promise<void> => {
    if (!state.run || !isRunActive(state.stage)) return;
    const isSessionCurrent = captureSession();
    await cancelAgentRun(projectId, state.run.runId, requestId());
    if (isSessionCurrent()) await Promise.all([loadAuthority(), refreshPageActivity(true)]);
  }, [captureSession, loadAuthority, projectId, refreshPageActivity, state.run, state.stage]);

  const retry = useCallback(async (): Promise<void> => {
    const request = usePendingOperations.getState().agents[pageKey];
    if (request) {
      const text = request.input.content.blocks
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');
      await submit({ text }, request.input);
      return;
    }
    const submitted = lastSubmission.current;
    if (
      canSend &&
      state.run &&
      submitted?.runId === state.run.runId &&
      !submitted.repair &&
      ['failed', 'cancelled', 'interrupted'].includes(state.run.status)
    ) {
      await submit({ text: submitted.text, retryOfRunId: state.run.runId });
    } else await Promise.all([loadAuthority(), refreshPageActivity(true)]);
  }, [canSend, pageKey, loadAuthority, refreshPageActivity, state.run, submit]);

  const selectConversation = (id: string | null): boolean => {
    const operations = usePendingOperations.getState();
    if (
      activity !== 'idle' ||
      sending.current ||
      operations.agents[pageKey] ||
      operations.agentPreparations[pageKey] ||
      selection.current === id
    )
      return false;
    selection.current = id;
    setConversationId(id);
    clearMessages();
    setHistoryReady(null);
    dispatch({ type: 'reset' });
    void loadAuthority();
    return true;
  };

  return {
    state: pageActivity.error && !state.error ? { ...state, error: pageActivity.error } : state,
    activity,
    canSend,
    committedWorkingVersion: pageActivity.committedWorkingVersion,
    hasOlderMessages,
    loadingOlderMessages,
    loadOlderMessages,
    conversationId,
    selectConversation,
    pendingSubmission: Boolean(pending && !pending.inFlight),
    clarificationExpired: Boolean(
      clarification &&
      (rejectedClarification === clarification.clarificationId ||
        (workingVersion !== undefined && workingVersion !== clarification.baseWorkingVersion)),
    ),
    send,
    repair: (evidence: RuntimeRepairEvidence, workingVersion: number) =>
      submit({
        text: '分析并修复这次预览交互中选中的节点故障。',
        repair: { evidence, workingVersion },
      }),
    selectClarification,
    cancel,
    retry,
    refresh: async () => {
      await Promise.all([loadAuthority(), refreshPageActivity(true)]);
    },
  };
};
