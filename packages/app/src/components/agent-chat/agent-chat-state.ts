import type {
  AgentEvent,
  AgentMessage,
  AgentRun,
  AgentRunStatus,
} from '@origamix/shared/protocol/agent';

export interface ToolActivity {
  id: string;
  name: string;
  status: 'running' | 'completed' | 'failed';
}

export interface AgentChatState {
  messages: AgentMessage[];
  run: AgentRun | null;
  streamedText: string;
  stage: AgentRunStatus | null;
  tools: ToolActivity[];
  committedRevisionId: string | null;
  lastEventId: number;
  error: string | null;
  connection: 'idle' | 'connecting' | 'connected' | 'recovering';
}

export type AgentChatAction =
  | { type: 'history.loaded'; messages: AgentMessage[]; run?: AgentRun | null }
  | { type: 'history.failed'; message: string }
  | { type: 'run.queued'; run: AgentRun }
  | { type: 'event.received'; event: AgentEvent }
  | { type: 'connection.changed'; connection: AgentChatState['connection'] }
  | { type: 'reset' };

export const initialAgentChatState: AgentChatState = {
  messages: [],
  run: null,
  streamedText: '',
  stage: null,
  tools: [],
  committedRevisionId: null,
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
  const value = payloadString(event.payload, ['status']);
  const statuses: AgentRunStatus[] = [
    'queued',
    'classifying',
    'generating',
    'tool_calling',
    'validating',
    'committing',
    'awaiting_confirmation',
    'cancelling',
    'completed',
    'failed',
    'cancelled',
    'interrupted',
  ];
  if (value && statuses.includes(value as AgentRunStatus)) return value as AgentRunStatus;
  if (event.type === 'run.completed') return 'completed';
  if (event.type === 'run.failed') return 'failed';
  if (event.type === 'run.cancelled') return 'cancelled';
  return undefined;
};

const updateTool = (tools: ToolActivity[], event: AgentEvent): ToolActivity[] => {
  const record = payloadRecord(event.payload);
  const id = payloadString(record, ['toolCallId', 'id']);
  if (!id) return tools;
  const current = tools.find((tool) => tool.id === id);
  const name = payloadString(record, ['toolName', 'name']) ?? current?.name ?? '页面工具';
  const status =
    event.type === 'tool.started'
      ? 'running'
      : event.type === 'tool.failed' || record.status === 'failed'
        ? 'failed'
        : 'completed';
  return [...tools.filter((tool) => tool.id !== id), { id, name, status }];
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
  if (action.type === 'history.loaded') {
    const changedRun = action.run?.runId !== state.run?.runId;
    return {
      ...state,
      messages: [...action.messages].sort((a, b) => a.sequence - b.sequence),
      run: action.run ?? null,
      stage: action.run?.status ?? null,
      streamedText: '',
      tools: [],
      lastEventId: changedRun ? -1 : state.lastEventId,
      committedRevisionId: action.run?.resultWorkingVersion
        ? `working_${action.run.runId}_${action.run.resultWorkingVersion}`
        : (action.run?.resultRevisionId ?? (changedRun ? null : state.committedRevisionId)),
      error:
        action.run?.status === 'interrupted'
          ? '上次生成因服务重启而中断，请重新描述并发送。'
          : null,
      connection: 'idle',
    };
  }
  if (action.type === 'run.queued') {
    return {
      ...state,
      run: action.run,
      stage: action.run.status,
      streamedText: '',
      tools: [],
      committedRevisionId: null,
      lastEventId: -1,
      error: null,
      connection: 'connecting',
    };
  }

  const event = action.event;
  if (event.eventId <= state.lastEventId) return state;
  const status = statusFromEvent(event);
  const text =
    event.type === 'assistant.delta'
      ? (payloadString(event.payload, ['delta', 'text', 'content']) ?? '')
      : '';
  const isToolEvent = event.type.startsWith('tool.');
  const error =
    event.type === 'run.failed'
      ? (payloadString(event.payload, ['safeMessage', 'message']) ?? '生成失败，请重试。')
      : event.type === 'run.cancelled'
        ? null
        : state.error;
  return {
    ...state,
    lastEventId: event.eventId,
    streamedText: state.streamedText + text,
    stage: status ?? state.stage,
    tools: isToolEvent ? updateTool(state.tools, event) : state.tools,
    committedRevisionId:
      event.type === 'run.completed' &&
      typeof payloadRecord(event.payload).workingVersion === 'number'
        ? `working_${event.runId}_${String(payloadRecord(event.payload).workingVersion)}`
        : event.type === 'schema.committed'
          ? (event.revisionId ??
            payloadString(event.payload, ['revisionId']) ??
            state.committedRevisionId)
          : state.committedRevisionId,
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
