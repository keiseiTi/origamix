import type { PageRecord, ProjectRecord } from '@origamix/shared/protocol/api';
import { request } from './request';

export const projectsService = {
  list: (): Promise<ProjectRecord[]> => request<ProjectRecord[]>('/projects'),
  create: (input: {
    name: string;
    code: string;
    directoryGrantId: string;
  }): Promise<ProjectRecord> =>
    request<ProjectRecord>('/projects', { method: 'POST', body: JSON.stringify(input) }),
  open: (input: { directoryGrantId: string }): Promise<ProjectRecord> =>
    request<ProjectRecord>('/projects/open', { method: 'POST', body: JSON.stringify(input) }),
  pages: (projectId: string): Promise<PageRecord[]> =>
    request<PageRecord[]>(`/projects/${projectId}/pages`),
  createPage: (projectId: string, input: { name: string; slug: string }): Promise<PageRecord> =>
    request<PageRecord>(`/projects/${projectId}/pages`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
