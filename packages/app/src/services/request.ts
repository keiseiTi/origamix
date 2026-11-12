import { isApiResultEnvelope, type BackendStatus } from '@origamix/shared';

export interface ApiConnection {
  baseUrl: string;
  token: string;
  serviceInstanceId: string;
}

let connection: ApiConnection | undefined;
let pendingConnection: Promise<ApiConnection> | undefined;
let connectionGeneration = 0;
let backendAvailable = true;
const statusListeners = new Set<(status: BackendStatus) => void>();
export class BackendConnectionChangedError extends Error {
  constructor() {
    super('后端连接已更新，请确认操作结果后重试');
    this.name = 'BackendConnectionChangedError';
  }
}
const invalidateConnection = () => {
  connectionGeneration += 1;
  connection = undefined;
  pendingConnection = undefined;
};
export const subscribeBackendStatus = (listener: (status: BackendStatus) => void): (() => void) => {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
};
export const subscribeBackendReady = (listener: () => void): (() => void) =>
  subscribeBackendStatus((status) => {
    if (status === 'ready') listener();
  });

/** One owned subscription in App. Events carry status only, never credentials. */
export const watchBackendConnection = (): (() => void) => {
  let active = true;
  const unsubscribe = window.api?.backend?.onStatusChanged?.((status) => {
    if (!active) return;
    invalidateConnection();
    backendAvailable = status !== 'restarting';
    const generation = connectionGeneration;
    if (status !== 'ready') {
      for (const listener of statusListeners) listener(status);
      return;
    }
    void getApiConnection()
      .then(() => {
        if (active && generation === connectionGeneration)
          for (const listener of statusListeners) listener('ready');
      })
      .catch(() => {
        if (active && generation === connectionGeneration) {
          backendAvailable = true;
          for (const listener of statusListeners) listener('unavailable');
        }
      });
  });
  return () => {
    active = false;
    unsubscribe?.();
  };
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export const getApiConnection = async (forceRefresh = false): Promise<ApiConnection> => {
  if (forceRefresh) invalidateConnection();
  if (!backendAvailable) throw new Error('后端正在重启或暂时不可用，请稍后重试');
  if (connection) return connection;
  if (pendingConnection) return pendingConnection;
  const generation = connectionGeneration;
  const load = async (): Promise<ApiConnection> => {
    let next = await window.api?.backend?.getConnection?.();
    if (generation !== connectionGeneration) throw new BackendConnectionChangedError();
    if (!next && import.meta.env.DEV) {
      // Only the Vite host authenticates the same-origin browser proxy.
      next = { baseUrl: '/api/v1', token: '', serviceInstanceId: '' };
    }
    if (!next) throw new Error('当前环境不支持本地服务，请在桌面应用中打开。');
    connection = next;
    return next;
  };
  pendingConnection = load().finally(() => {
    if (generation === connectionGeneration) pendingConnection = undefined;
  });
  return pendingConnection;
};

export const refreshBackendConnection = async (): Promise<ApiConnection> => {
  return getApiConnection(true);
};

const headersFor = (current: ApiConnection) => ({
  ...(current.token ? { Authorization: `Bearer ${current.token}` } : {}),
  ...(current.serviceInstanceId ? { 'x-origamix-service': current.serviceInstanceId } : {}),
  'content-type': 'application/json',
});

const fetchWithConnection = async (
  current: ApiConnection,
  path: string,
  body: string,
): Promise<Response> =>
  fetch(`${current.baseUrl}${path}`, {
    method: 'POST',
    cache: 'no-store',
    body,
    headers: headersFor(current),
  });

export const request = async <T>(
  path: string,
  data: object = {},
  validate?: (value: unknown) => value is T,
): Promise<T> => {
  const body = JSON.stringify(data);
  const current = await getApiConnection();
  let generation = connectionGeneration;
  let response: Response;
  try {
    response = await fetchWithConnection(current, path, body);
  } catch (error) {
    // Do not replay a mutation after an ambiguous network failure. Clearing the
    // dead connection lets an explicit retry/SSE reconnect obtain fresh authority.
    if (window.api?.backend?.getConnection && generation === connectionGeneration)
      invalidateConnection();
    throw error;
  }
  if (generation !== connectionGeneration || !backendAvailable)
    throw new BackendConnectionChangedError();
  if (response.status === 401 && window.api?.backend?.getConnection) {
    const refreshed = await refreshBackendConnection();
    if (
      refreshed.serviceInstanceId !== current.serviceInstanceId ||
      refreshed.baseUrl !== current.baseUrl ||
      refreshed.token !== current.token
    ) {
      generation = connectionGeneration;
      response = await fetchWithConnection(refreshed, path, body);
    }
  }
  const result = await response.json();
  if (generation !== connectionGeneration || !backendAvailable)
    throw new BackendConnectionChangedError();
  if (!isApiResultEnvelope(result))
    throw new ApiRequestError('服务返回格式无效', 500, response.status);
  if (!result.success)
    throw new ApiRequestError(result.message ?? '请求失败', result.code, response.status);
  if (validate && !validate(result.data))
    throw new ApiRequestError('服务返回数据无效', 500, response.status);
  return result.data as T;
};

/** Read-only streamed proposals are never replayed on connection replacement. */
export const requestStream = async (
  path: string,
  data: object,
  signal: AbortSignal,
  receive: (value: unknown) => void,
): Promise<void> => {
  const current = await getApiConnection();
  const generation = connectionGeneration;
  const response = await fetch(`${current.baseUrl}${path}`, {
    method: 'POST',
    cache: 'no-store',
    headers: headersFor(current),
    body: JSON.stringify(data),
    signal,
  });
  const assertCurrent = () => {
    if (generation !== connectionGeneration || !backendAvailable)
      throw new BackendConnectionChangedError();
    signal.throwIfAborted();
  };
  assertCurrent();
  if (!response.ok) {
    const result: unknown = await response.json();
    assertCurrent();
    throw new ApiRequestError(
      isApiResultEnvelope(result) && !result.success ? (result.message ?? '请求失败') : '请求失败',
      response.status,
      response.status,
    );
  }
  if (!response.body || !response.headers.get('content-type')?.includes('application/x-ndjson'))
    throw new Error('助手返回格式无效');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      assertCurrent();
      if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > 1024 * 1024) throw new Error('助手结果过大，请缩小修改范围');
      buffer += decoder.decode(chunk.value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line) receive(JSON.parse(line));
      }
    }
    if (buffer.trim()) throw new Error('助手结果不完整，草稿已保留');
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
};
