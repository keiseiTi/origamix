import type { OpenProjectResult, PageRecord, ProjectRecord } from '@origamix/shared/protocol/api';
import { request } from './request';

export const projectsService = {
  list: (): Promise<ProjectRecord[]> => request<ProjectRecord[]>('/projects'),
  create: (input: {
    name: string;
    code: string;
    directoryGrantId: string;
  }): Promise<ProjectRecord> =>
    request<ProjectRecord>('/projects', { method: 'POST', body: JSON.stringify(input) }),
  open: (input: {
    directoryGrantId: string;
    initializeIfNeeded?: boolean;
  }): Promise<OpenProjectResult> =>
    request<OpenProjectResult>('/projects/open', { method: 'POST', body: JSON.stringify(input) }),
  rename: (projectId: string, name: string): Promise<ProjectRecord> =>
    request<ProjectRecord>(`/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  delete: (projectId: string): Promise<{ deleted: true }> =>
    request<{ deleted: true }>(`/projects/${projectId}`, {
      method: 'DELETE',
      body: JSON.stringify({ scope: 'desktop_record' }),
    }),
  pages: (projectId: string): Promise<PageRecord[]> =>
    request<PageRecord[]>(`/projects/${projectId}/pages`),
  createPage: (projectId: string, input: { name: string; slug: string }): Promise<PageRecord> =>
    request<PageRecord>(`/projects/${projectId}/pages`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  renamePage: (projectId: string, pageId: string, name: string): Promise<PageRecord> =>
    request<PageRecord>(`/pages/${pageId}`, {
      projectId,
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),
  duplicatePage: (projectId: string, pageId: string): Promise<PageRecord> =>
    request<PageRecord>(`/pages/${pageId}/duplicate`, {
      projectId,
      method: 'POST',
      body: JSON.stringify({}),
    }),
  deletePage: (projectId: string, pageId: string): Promise<{ deleted: true }> =>
    request<{ deleted: true }>(`/pages/${pageId}`, {
      projectId,
      method: 'DELETE',
      body: JSON.stringify({ scope: 'desktop_record' }),
    }),
};
