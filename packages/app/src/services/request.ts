import type { ApiResult } from '@origamix/shared/protocol/api';

interface Connection {
  baseUrl: string;
  token: string;
  serviceInstanceId: string;
}

let connection: Connection | undefined;

async function getConnection(): Promise<Connection> {
  connection ??= await window.api.backend.getConnection();
  return connection;
}

export async function request<T>(
  path: string,
  init?: RequestInit & { projectId?: string }
): Promise<T> {
  const current = await getConnection();
  const response = await fetch(`${current.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${current.token}`,
      'x-origamix-service': current.serviceInstanceId,
      ...(init?.projectId ? { 'x-origamix-project-id': init.projectId } : {}),
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers
    }
  });
  const result = (await response.json()) as ApiResult<T>;
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}
