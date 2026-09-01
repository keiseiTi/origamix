import type { ApiResult } from '@origamix/shared/protocol/api';

interface Connection {
  baseUrl: string;
  token: string;
  serviceInstanceId: string;
}

let connection: Connection | undefined;

async function getConnection(): Promise<Connection> {
  connection ??= await window.api?.backend?.getConnection?.();
  if (!connection && import.meta.env.DEV) {
    // The Vite host owns credentials and authenticates the same-origin proxy.
    connection = { baseUrl: '/api/v1', token: '', serviceInstanceId: '' };
  }
  if (!connection) throw new Error('当前环境不支持本地服务，请在桌面应用中打开。');
  return connection;
}

export async function request<T>(
  path: string,
  init?: RequestInit & { projectId?: string },
): Promise<T> {
  const current = await getConnection();
  const response = await fetch(`${current.baseUrl}${path}`, {
    ...init,
    headers: {
      ...(current.token ? { Authorization: `Bearer ${current.token}` } : {}),
      ...(current.serviceInstanceId ? { 'x-origamix-service': current.serviceInstanceId } : {}),
      ...(init?.projectId ? { 'x-origamix-project-id': init.projectId } : {}),
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const result = (await response.json()) as ApiResult<T>;
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}
