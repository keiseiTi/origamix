import type {
  AgentEvent,
  CancelAgentRunResponse,
  CreateAgentRunRequest,
  CreateAgentRunResponse,
  GetAgentRunResponse,
  ListConversationsResponse,
  ListMessagesResponse,
} from '@origamix/shared/protocol/agent';
import { getApiConnection, refreshBackendConnection, request } from './request';

const isAgentEvent = (value: unknown): value is AgentEvent => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  return (
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
    !Number.isNaN(Date.parse(event['occurredAt']))
  );
};

export const listConversations = (projectId: string, pageId: string) =>
  request<ListConversationsResponse>(`/pages/${encodeURIComponent(pageId)}/conversations`, {
    projectId,
  });

export const listMessages = (
  projectId: string,
  pageId: string,
  conversationId: string,
  afterSequence = -1,
) =>
  request<ListMessagesResponse>(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
    projectId,
    headers: {
      'x-origamix-page-id': pageId,
      'x-origamix-after-sequence': String(afterSequence),
    },
  });

export const listAllMessages = async (
  projectId: string,
  pageId: string,
  conversationId: string,
): Promise<ListMessagesResponse> => {
  const messages: ListMessagesResponse['messages'] = [];
  let afterSequence = -1;
  while (true) {
    const page = await listMessages(projectId, pageId, conversationId, afterSequence);
    messages.push(...page.messages);
    if (page.messages.length < 100) break;
    const next = page.messages.at(-1)?.sequence;
    if (next === undefined || next <= afterSequence) break;
    afterSequence = next;
  }
  return { version: '1', messages };
};

export const createAgentRun = (input: CreateAgentRunRequest) =>
  request<CreateAgentRunResponse>('/agent/runs', {
    method: 'POST',
    projectId: input.projectId,
    body: JSON.stringify(input),
  });

export const getAgentRun = (projectId: string, runId: string) =>
  request<GetAgentRunResponse>(`/agent/runs/${encodeURIComponent(runId)}`, { projectId });

export const cancelAgentRun = (projectId: string, runId: string, requestId: string) =>
  request<CancelAgentRunResponse>(`/agent/runs/${encodeURIComponent(runId)}/cancel`, {
    method: 'POST',
    projectId,
    body: JSON.stringify({ version: '1', requestId }),
  });

export interface AgentEventSubscriptionOptions {
  afterEventId?: number;
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
  const controller = new AbortController();
  let lastEventId = options.afterEventId ?? -1;
  let stopped = false;

  const connect = async (refresh = false): Promise<void> => {
    const current = refresh ? await refreshBackendConnection() : await getApiConnection();
    const response = await fetch(
      `${current.baseUrl}/agent/runs/${encodeURIComponent(runId)}/events?afterEventId=${lastEventId}`,
      {
        signal: controller.signal,
        headers: {
          ...(current.token ? { Authorization: `Bearer ${current.token}` } : {}),
          ...(current.serviceInstanceId ? { 'x-origamix-service': current.serviceInstanceId } : {}),
          'x-origamix-project-id': projectId,
          ...(lastEventId >= 0 ? { 'last-event-id': String(lastEventId) } : {}),
          Accept: 'text/event-stream',
        },
      },
    );
    if (response.status === 401 && !refresh) return connect(true);
    if (!response.ok || !response.body) throw new Error(`事件流连接失败（${response.status}）`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (!stopped) {
      const { done, value } = await reader.read();
      if (done) break;
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
        if (!isAgentEvent(value)) continue;
        const event = value;
        if (event.runId !== runId || event.eventId <= lastEventId) continue;
        lastEventId = event.eventId;
        options.onEvent(event);
      }
    }
    if (!stopped) options.onClose?.();
  };
  void connect().catch((error: unknown) => {
    if (!stopped && !controller.signal.aborted)
      options.onError?.(error instanceof Error ? error : new Error('事件流连接失败'));
  });
  return () => {
    stopped = true;
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
