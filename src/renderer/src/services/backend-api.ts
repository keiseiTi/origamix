import type {
  ApiResult,
  PageRecord,
  ProjectRecord,
  WorkspaceRecord
} from '../../../shared/protocol/api';
import type { OrigamixPageSchema } from '../../../shared/protocol/schema';

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

async function request<T>(path: string, init?: RequestInit & { projectId?: string }): Promise<T> {
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

export const backendApi = {
  workspace: {
    get: () => request<WorkspaceRecord>('/workspace'),
    save: (input: Partial<Omit<WorkspaceRecord, 'updatedAt'>>) =>
      request<WorkspaceRecord>('/workspace', { method: 'PATCH', body: JSON.stringify(input) })
  },
  projects: {
    list: () => request<ProjectRecord[]>('/projects'),
    create: (input: { name: string; directoryGrantId: string }) =>
      request<ProjectRecord>('/projects', { method: 'POST', body: JSON.stringify(input) }),
    open: (input: { directoryGrantId: string }) =>
      request<ProjectRecord>('/projects/open', { method: 'POST', body: JSON.stringify(input) }),
    pages: (projectId: string) => request<PageRecord[]>(`/projects/${projectId}/pages`),
    createPage: (projectId: string, input: { name: string; slug: string }) =>
      request<PageRecord>(`/projects/${projectId}/pages`, {
        method: 'POST',
        body: JSON.stringify(input)
      })
  },
  schema: {
    get: (projectId: string, pageId: string) =>
      request<{ schema: OrigamixPageSchema; revisionId: string }>(`/pages/${pageId}/schema`, {
        projectId
      }),
    updateProps: (
      projectId: string,
      pageId: string,
      input: { baseRevisionId: string; elementId: string; props: Record<string, unknown> }
    ) =>
      request<{ schema: OrigamixPageSchema; revisionId: string }>(`/pages/${pageId}/changesets`, {
        projectId,
        method: 'POST',
        body: JSON.stringify({
          pageId,
          baseRevisionId: input.baseRevisionId,
          source: { kind: 'user' },
          createdAt: new Date().toISOString(),
          operation: 'updateElementProps',
          elementId: input.elementId,
          props: input.props
        })
      }),
    undo: (projectId: string, pageId: string) =>
      request<{ schema: OrigamixPageSchema; revisionId: string }>(`/pages/${pageId}/undo`, {
        projectId,
        method: 'POST'
      })
  }
};
