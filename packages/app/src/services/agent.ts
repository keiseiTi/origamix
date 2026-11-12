import { notifyPageRolesChanged } from './page-role-events';
type SessionKind = 'page';
import type {
  AgentEvent,
  CancelAgentRunResponse,
  CreateAgentRunRequest,
  CreateAgentRunResponse,
  GetAgentRunResponse,
  ListConversationsResponse,
  ListMessagesResponse,
} from '@origamix/shared';
import {
  getApiConnection,
  refreshBackendConnection,
  request,
  subscribeBackendStatus,
} from './request';

const agentPrefix = (kind: SessionKind) => {
  if (kind !== 'page') throw new Error('只支持页面 Agent');
  return '/agent';
};
const agentScope = (projectId: string, pageId: string, kind: SessionKind) => ({
  projectId,
  ...(kind === 'page' ? { pageId } : {}),
});

const isAgentEvent = (value: unknown): value is AgentEvent => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  const validEnvelope =
    event['version'] === '1' &&
    Number.isSafeInteger(event['eventId']) &&
    Number(event['eventId']) >= 0 &&
    Number.isSafeInteger(event['sequence']) &&
    Number(event['sequence']) >= 0 &&
    typeof event['type'] === 'string' &&
    event['type'].length > 0 &&
    typeof event['runId'] === 'string' &&
    /^run_[A-Za-z0-9_-]+$/.test(event['runId']) &&
    typeof event['pageId'] === 'string' &&
    /^page_[A-Za-z0-9_-]+$/.test(event['pageId']) &&
    typeof event['requestId'] === 'string' &&
    event['requestId'].length > 0 &&
    typeof event['occurredAt'] === 'string' &&
    !Number.isNaN(Date.parse(event['occurredAt']));
  if (!validEnvelope) return false;
  const payload = event['payload'];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const record = payload as Record<string, unknown>;
  if (event['type'] === 'run.queued') return record['status'] === 'queued';
  if (event['type'] === 'run.progress') {
    return (
      typeof record['status'] === 'string' &&
      record['phase'] === record['status'] &&
      typeof record['message'] === 'string'
    );
  }
  if (event['type'] === 'working.committed') {
    return (
      Number.isSafeInteger(record['baseWorkingVersion']) &&
      Number.isSafeInteger(record['resultWorkingVersion']) &&
      Number.isSafeInteger(record['operationCount'])
    );
  }
  if (event['type'] === 'clarification.available') {
    return (
      record['status'] === 'completed' &&
      record['outcome'] === 'needs_clarification' &&
      Boolean(record['clarification'])
    );
  }
  if (event['type'] === 'tool.activity') {
    return typeof record['toolName'] === 'string' && typeof record['phase'] === 'string';
  }
  if (event['type'] === 'run.completed') {
    return (
      record['status'] === 'completed' &&
      typeof record['outcome'] === 'string' &&
      (record['response'] === undefined || typeof record['response'] === 'string')
    );
  }
  if (event['type'] === 'run.failed') {
    return (
      record['status'] === 'failed' &&
      typeof record['errorCode'] === 'string' &&
      typeof record['safeMessage'] === 'string'
    );
  }
  if (event['type'] === 'run.cancelled' || event['type'] === 'run.interrupted') {
    return record['status'] === event['type'].slice(4);
  }
  return false;
};

export const listConversations = (projectId: string, pageId: string, kind: SessionKind = 'page') =>
  request<ListConversationsResponse>(
    `${agentPrefix(kind)}/conversations/list`,
    agentScope(projectId, pageId, kind),
  );

export const listMessages = (
  projectId: string,
  pageId: string,
  conversationId: string,
  afterSequence = -1,
  kind: SessionKind = 'page',
) =>
  request<ListMessagesResponse>(`${agentPrefix(kind)}/messages/list`, {
    ...agentScope(projectId, pageId, kind),
    conversationId,
    afterSequence,
  });

export const listAllMessages = async (
  projectId: string,
  pageId: string,
  conversationId: string,
  kind: SessionKind = 'page',
): Promise<ListMessagesResponse> => {
  const messages: ListMessagesResponse['messages'] = [];
  let afterSequence = -1;
  while (true) {
    const page = await listMessages(projectId, pageId, conversationId, afterSequence, kind);
    messages.push(...page.messages);
    if (page.messages.length < 100) break;
    const next = page.messages.at(-1)?.sequence;
    if (next === undefined || next <= afterSequence) break;
    afterSequence = next;
  }
  return { version: '1', messages };
};

export const createAgentRun = (input: CreateAgentRunRequest) =>
  request<CreateAgentRunResponse>(
    `${agentPrefix(input.target?.kind ?? 'page')}/runs/create`,
    input,
  );

export const getAgentRun = (projectId: string, runId: string, kind: SessionKind = 'page') =>
  request<GetAgentRunResponse>(`${agentPrefix(kind)}/runs/get`, { projectId, runId });

export const cancelAgentRun = (
  projectId: string,
  runId: string,
  requestId: string,
  kind: SessionKind = 'page',
) =>
  request<CancelAgentRunResponse>(`${agentPrefix(kind)}/runs/cancel`, {
    version: '1',
    projectId,
    runId,
    requestId,
  });

export interface AgentEventSubscriptionOptions {
  afterEventId?: number;
  onOpen?(): void;
  onEvent(event: AgentEvent): void;
  onError?(error: Error): void;
  onClose?(): void;
}

/** Authenticated fetch-based SSE; EventSource cannot carry the desktop bearer token. */
export const subscribeAgentEvents = (
  projectId: string,
  runId: string,
  options: AgentEventSubscriptionOptions,
  kind: SessionKind = 'page',
): (() => void) => {
  let controller = new AbortController();
  let generation = 0;
  let lastEventId = options.afterEventId ?? -1;
  let stopped = false;

  const connect = async (refresh = false, epoch = generation): Promise<void> => {
    const ownedController = controller;
    const active = () => !stopped && generation === epoch && !ownedController.signal.aborted;
    const current = refresh ? await refreshBackendConnection() : await getApiConnection();
    if (!active()) return;
    const response = await fetch(
      `${current.baseUrl}/projects/${encodeURIComponent(projectId)}${agentPrefix(kind)}/runs/${encodeURIComponent(runId)}/events?afterEventId=${lastEventId}`,
      {
        signal: ownedController.signal,
        headers: {
          ...(current.token ? { Authorization: `Bearer ${current.token}` } : {}),
          ...(current.serviceInstanceId ? { 'x-origamix-service': current.serviceInstanceId } : {}),
          ...(lastEventId >= 0 ? { 'last-event-id': String(lastEventId) } : {}),
          Accept: 'text/event-stream',
        },
      },
    );
    if (!active()) return;
    if (response.status === 401 && !refresh) return connect(true, epoch);
    if (!response.ok || !response.body) throw new Error(`事件流连接失败（${response.status}）`);
    options.onOpen?.();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (active()) {
      const { done, value } = await reader.read();
      if (done || !active()) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (!data) continue;
        let value: unknown;
        try {
          value = JSON.parse(data);
        } catch {
          continue;
        }
        if (!active() || !isAgentEvent(value)) continue;
        const event = value;
        if (event.runId !== runId || event.eventId <= lastEventId) continue;
        lastEventId = event.eventId;
        options.onEvent(event);
      }
    }
    if (active()) options.onClose?.();
  };
  const start = () => {
    controller.abort();
    controller = new AbortController();
    const epoch = ++generation;
    void connect(false, epoch).catch((error: unknown) => {
      if (!stopped && epoch === generation && !controller.signal.aborted)
        options.onError?.(error instanceof Error ? error : new Error('事件流连接失败'));
    });
  };
  const unsubscribe = subscribeBackendStatus((status) => {
    if (status === 'ready') {
      // Replay buffers are process-local; the new service owns a new event sequence.
      lastEventId = -1;
      start();
    } else {
      generation += 1;
      controller.abort();
    }
  });
  start();
  return () => {
    stopped = true;
    generation += 1;
    unsubscribe();
    controller.abort();
  };
};

export const agentService = {
  listConversations,
  listMessages,
  listAllMessages,
  createAgentRun,
  getAgentRun,
  cancelAgentRun,
  subscribeAgentEvents,
};

export const getProjectTask = (
  scope: import('@origamix/shared').ProjectTaskScope,
): Promise<import('@origamix/shared').ProjectTaskState> =>
  request('/agent/project-task/get', scope);
export const decideProjectTask = async (
  input: import('@origamix/shared').ProjectTaskDecision,
): Promise<import('@origamix/shared').ProjectTaskState> => {
  try {
    return await request('/agent/project-task/decide', input);
  } finally {
    notifyPageRolesChanged(input.projectId);
  }
};
