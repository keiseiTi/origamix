import type {
  AgentEvent,
  AgentMessage,
  AgentRun,
  AgentRunStatus,
  ClarificationResult,
} from '@origamix/shared/protocol/agent';

export interface AgentChatState {
  messages: AgentMessage[];
  run: AgentRun | null;
  streamedText: string;
  stage: AgentRunStatus | null;
  progressMessage: string | null;
  progressHistory: string[];
  workingRefreshKey: string | null;
  lastEventId: number;
  error: string | null;
  connection: 'idle' | 'connecting' | 'connected' | 'recovering';
}

export type AgentChatAction =
  | {
      type: 'history.loaded';
      messages: AgentMessage[];
      run?: AgentRun | null;
      preserveStream?: boolean;
    }
  | { type: 'history.failed'; message: string }
  | { type: 'submission.started' }
  | { type: 'run.queued'; run: AgentRun }
  | { type: 'event.received'; event: AgentEvent }
  | { type: 'connection.changed'; connection: AgentChatState['connection'] }
  | { type: 'reset' };

export const initialAgentChatState: AgentChatState = {
  messages: [],
  run: null,
  streamedText: '',
  stage: null,
  progressMessage: null,
  progressHistory: [],
  workingRefreshKey: null,
  lastEventId: -1,
  error: null,
  connection: 'idle',
};

const terminalStatuses = new Set<AgentRunStatus>([
  'completed',
  'failed',
  'cancelled',
  'interrupted',
]);

export const isRunActive = (status?: AgentRunStatus | null): boolean => {
  return Boolean(status && !terminalStatuses.has(status));
};

const payloadRecord = (payload: unknown): Record<string, unknown> => {
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
};

const payloadString = (payload: unknown, keys: string[]): string | undefined => {
  const record = payloadRecord(payload);
  for (const key of keys) if (typeof record[key] === 'string') return record[key];
  return undefined;
};

const statusFromEvent = (event: AgentEvent): AgentRunStatus | undefined => {
  if (event.type === 'run.progress') {
    const value = payloadRecord(event.payload).status;
    const progressStatuses: AgentRunStatus[] = [
      'preparing',
      'reasoning',
      'reading',
      'deciding',
      'validating',
      'repairing',
      'committing',
    ];
    if (typeof value === 'string' && progressStatuses.includes(value as AgentRunStatus)) {
      return value as AgentRunStatus;
    }
  }
  if (event.type === 'run.queued') return 'queued';
  if (event.type === 'run.completed') return 'completed';
  if (event.type === 'run.failed') return 'failed';
  if (event.type === 'run.cancelled') return 'cancelled';
  if (event.type === 'run.interrupted') return 'interrupted';
  return undefined;
};

const toolLabels: Record<string, string> = {
  get_page_context: '读取页面上下文',
  get_schema_outline: '读取页面结构',
  get_schema_fragment: '读取元素详情',
  search_materials: '查找可用物料',
  get_material_manifest: '读取物料定义',
  search_product_docs: '查询产品规则',
  validate_page_schema: '校验页面结构',
  get_page_diagnostics: '检查页面诊断',
  complete_page_run: '生成并执行页面操作链',
};

const toolProgress = (payload: Record<string, unknown>): string | null => {
  if (typeof payload.toolName !== 'string') return null;
  const label = toolLabels[payload.toolName] ?? payload.toolName;
  const phase =
    payload.phase === 'started'
      ? '开始'
      : payload.phase === 'completed'
        ? '完成'
        : payload.phase === 'failed' || payload.phase === 'denied'
          ? '失败'
          : null;
  return phase ? `${label} · ${phase}` : null;
};

/** Applies replayable SSE events. Duplicate and out-of-order events are intentionally ignored. */
export const agentChatReducer = (
  state: AgentChatState,
  action: AgentChatAction,
): AgentChatState => {
  if (action.type === 'reset') return initialAgentChatState;
  if (action.type === 'connection.changed') return { ...state, connection: action.connection };
  if (action.type === 'history.failed')
    return { ...state, error: action.message, connection: 'idle' };
  if (action.type === 'submission.started')
    return {
      ...state,
      run: null,
      stage: 'queued',
      streamedText: '',
      progressMessage: '正在提交请求',
      progressHistory: ['正在提交请求'],
      workingRefreshKey: null,
      error: null,
      connection: 'connecting',
    };
  if (action.type === 'history.loaded') {
    if (action.preserveStream && action.run?.runId === state.run?.runId) {
      return {
        ...state,
        messages: [...action.messages].sort((a, b) => a.sequence - b.sequence),
      };
    }
    const changedRun = action.run?.runId !== state.run?.runId;
    const hasDurableAnswer = action.messages.some(
      (message) =>
        message.runId === action.run?.runId &&
        message.role === 'assistant' &&
        messageText(message).trim().length > 0,
    );
    const terminalProgress =
      action.run?.status === 'completed'
        ? '处理完成'
        : action.run?.status === 'failed'
          ? '处理失败'
          : null;
    const progressHistory =
      terminalProgress && state.progressHistory.at(-1) !== terminalProgress
        ? [...state.progressHistory, terminalProgress]
        : state.progressHistory;
    return {
      ...state,
      messages: [...action.messages].sort((a, b) => a.sequence - b.sequence),
      run: action.run ?? null,
      stage: action.run?.status ?? null,
      streamedText: changedRun || hasDurableAnswer ? '' : state.streamedText,
      progressMessage: isRunActive(action.run?.status) ? state.progressMessage : null,
      progressHistory: changedRun ? (terminalProgress ? [terminalProgress] : []) : progressHistory,
      lastEventId: changedRun ? -1 : state.lastEventId,
      workingRefreshKey: action.run?.resultWorkingVersion
        ? `working_${action.run.runId}_${action.run.resultWorkingVersion}`
        : changedRun
          ? null
          : state.workingRefreshKey,
      error:
        action.run?.status === 'interrupted'
          ? '上次生成因服务重启而中断，请重新描述并发送。'
          : null,
      connection: !changedRun && isRunActive(action.run?.status) ? state.connection : 'idle',
    };
  }
  if (action.type === 'run.queued') {
    return {
      ...state,
      run: action.run,
      // The Run snapshot can already be terminal for a fast model. Replay SSE
      // before presenting that terminal result so the execution path remains visible.
      stage: 'queued',
      streamedText: '',
      progressMessage: null,
      progressHistory: ['请求已进入处理队列'],
      workingRefreshKey: null,
      lastEventId: -1,
      error: null,
      connection: 'connecting',
    };
  }

  const event = action.event;
  if (state.run && (event.runId !== state.run.runId || event.pageId !== state.run.pageId)) {
    return state;
  }
  if (event.eventId <= state.lastEventId) return state;
  const status = statusFromEvent(event);
  const eventPayload = payloadRecord(event.payload);
  const text =
    event.type === 'run.completed' && typeof eventPayload.response === 'string'
      ? eventPayload.response
      : '';
  const progressMessage =
    event.type === 'run.progress' && typeof eventPayload.message === 'string'
      ? eventPayload.message
      : status && terminalStatuses.has(status)
        ? null
        : state.progressMessage;
  const error =
    event.type === 'run.failed'
      ? (payloadString(event.payload, ['safeMessage']) ?? '生成失败，请重试。')
      : event.type === 'run.cancelled'
        ? null
        : state.error;
  const progressEntry =
    event.type === 'run.progress' && typeof eventPayload.message === 'string'
      ? eventPayload.message
      : event.type === 'tool.activity'
        ? toolProgress(eventPayload)
        : event.type === 'working.committed'
          ? '页面操作链已执行，草稿已更新'
          : event.type === 'run.completed'
            ? '处理完成'
            : event.type === 'run.failed'
              ? '处理失败'
              : null;
  const progressHistory =
    progressEntry && state.progressHistory.at(-1) !== progressEntry
      ? [...state.progressHistory, progressEntry]
      : state.progressHistory;
  const run = state.run
    ? {
        ...state.run,
        ...(status ? { status } : {}),
        ...(event.type === 'run.completed' && typeof eventPayload.outcome === 'string'
          ? { outcome: eventPayload.outcome as AgentRun['outcome'] }
          : {}),
        ...(event.type === 'run.completed' && typeof eventPayload.resultWorkingVersion === 'number'
          ? { resultWorkingVersion: eventPayload.resultWorkingVersion }
          : {}),
        ...(event.type === 'clarification.available' && eventPayload.clarification
          ? { clarification: eventPayload.clarification as ClarificationResult }
          : {}),
      }
    : null;
  return {
    ...state,
    run,
    lastEventId: event.eventId,
    streamedText:
      text &&
      !state.messages.some(
        (message) =>
          message.runId === event.runId &&
          message.role === 'assistant' &&
          messageText(message).trim().length > 0,
      )
        ? text
        : state.streamedText,
    stage: status ?? state.stage,
    progressMessage,
    progressHistory,
    workingRefreshKey:
      (event.type === 'working.committed' || event.type === 'run.completed') &&
      typeof eventPayload.resultWorkingVersion === 'number'
        ? `working_${event.runId}_${String(eventPayload.resultWorkingVersion)}`
        : state.workingRefreshKey,
    error,
    connection: status && terminalStatuses.has(status) ? 'idle' : 'connected',
  };
};

export const messageText = (message: AgentMessage): string => {
  return message.content.blocks
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
};
