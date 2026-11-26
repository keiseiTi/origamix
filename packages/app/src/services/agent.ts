import {
  validateAgentEvent,
  validateCreateAgentRunResponse,
  validateGetPageAgentActivityResponse,
} from '@origamix/shared';
import { observeWebSession } from './web-session';
import type {
  AgentEvent,
  CancelAgentRunResponse,
  CreateAgentRunRequest,
  CreateAgentRunResponse,
  GetAgentRunResponse,
  GetPageAgentActivityResponse,
  ListConversationsResponse,
  ListMessagesResponse,
} from '@origamix/shared';
import {
  getApiConnection,
  refreshBackendConnection,
  request,
  subscribeBackendStatus,
} from './request';

export const getPageAgentActivity = (projectId: string, pageId: string) =>
  request<GetPageAgentActivityResponse>(
    '/agent/pages/activity',
    { projectId, pageId },
    (value): value is GetPageAgentActivityResponse =>
      validateGetPageAgentActivityResponse(value).valid,
  );

export const listConversations = (projectId: string, pageId: string, offset?: number) =>
  request<ListConversationsResponse>('/agent/conversations/list', { projectId, pageId, offset });

export const listMessages = (
  projectId: string,
  pageId: string,
  conversationId: string,
  cursor?: { afterSequence: number } | { beforeSequence: number },
) =>
  request<ListMessagesResponse>('/agent/messages/list', {
    projectId,
    pageId,
    conversationId,
    ...cursor,
  });

export const createAgentRun = (input: CreateAgentRunRequest) =>
  request<CreateAgentRunResponse>(
    '/agent/runs/create',
    input,
    (value): value is CreateAgentRunResponse => validateCreateAgentRunResponse(value).valid,
  );

export const getAgentRun = (projectId: string, runId: string) =>
  request<GetAgentRunResponse>('/agent/runs/get', { projectId, runId });

export const cancelAgentRun = (projectId: string, runId: string, requestId: string) =>
  request<CancelAgentRunResponse>('/agent/runs/cancel', {
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
      `${current.baseUrl}/projects/${encodeURIComponent(projectId)}/agent/runs/${encodeURIComponent(runId)}/events`,
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
    observeWebSession(response);
    if (response.status === 401 && current.token && !refresh) return connect(true, epoch);
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
        if (!active() || !validateAgentEvent(value).valid) continue;
        const event = value as AgentEvent;
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
  getPageAgentActivity,
  createAgentRun,
  getAgentRun,
  cancelAgentRun,
  subscribeAgentEvents,
};
