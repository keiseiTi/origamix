import { isApiResultEnvelope } from '@origamix/shared/protocol/api';

export interface ApiConnection {
  baseUrl: string;
  token: string;
  serviceInstanceId: string;
}

let connection: ApiConnection | undefined;

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
  if (forceRefresh) connection = undefined;
  connection ??= await window.api?.backend?.getConnection?.();
  if (!connection && import.meta.env.DEV) {
    // The Vite host owns credentials and authenticates the same-origin proxy.
    connection = { baseUrl: '/api/v1', token: '', serviceInstanceId: '' };
  }
  if (!connection) throw new Error('当前环境不支持本地服务，请在桌面应用中打开。');
  return connection;
};

export const refreshBackendConnection = async (): Promise<ApiConnection> => {
  return getApiConnection(true);
};

const headersFor = (current: ApiConnection, init?: RequestInit) => {
  return {
    ...(current.token ? { Authorization: `Bearer ${current.token}` } : {}),
    ...(current.serviceInstanceId ? { 'x-origamix-service': current.serviceInstanceId } : {}),
    ...(init?.body ? { 'content-type': 'application/json' } : {}),
    ...init?.headers,
  };
};

const fetchWithConnection = async (
  current: ApiConnection,
  path: string,
  init?: RequestInit,
): Promise<Response> => {
  return fetch(`${current.baseUrl}${path}`, {
    cache: 'no-store',
    ...init,
    headers: headersFor(current, init),
  });
};

export const request = async <T>(
  path: string,
  init?: RequestInit,
  validate?: (value: unknown) => value is T,
): Promise<T> => {
  const current = await getApiConnection();
  let response: Response;
  try {
    response = await fetchWithConnection(current, path, init);
  } catch (error) {
    // Do not replay a mutation after an ambiguous network failure. Clearing the
    // dead connection lets an explicit retry/SSE reconnect obtain fresh authority.
    if (window.api?.backend?.getConnection) connection = undefined;
    throw error;
  }
  if (response.status === 401 && window.api?.backend?.getConnection) {
    const refreshed = await refreshBackendConnection();
    if (
      refreshed.serviceInstanceId !== current.serviceInstanceId ||
      refreshed.baseUrl !== current.baseUrl ||
      refreshed.token !== current.token
    ) {
      response = await fetchWithConnection(refreshed, path, init);
    }
  }
  const result = await response.json();
  if (!isApiResultEnvelope(result))
    throw new ApiRequestError('服务返回格式无效', 500, response.status);
  if (!result.success)
    throw new ApiRequestError(result.message ?? '请求失败', result.code, response.status);
  if (validate && !validate(result.data))
    throw new ApiRequestError('服务返回数据无效', 500, response.status);
  return result.data as T;
};
