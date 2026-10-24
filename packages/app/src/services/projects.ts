import {
  type ProjectUpgradeState,
  type ProjectUpgradeRequest,
  type ProjectUpgradeResult,
  type OpenProjectResult,
  type PageRecord,
  type ProjectRecord,
  type ProjectWithPages,
  validateResolvedProjectStack,
  type ProjectStack,
} from '@origamix/shared';

import { request } from './request';

export const projectsService = {
  upgradeState: (projectId: string): Promise<ProjectUpgradeState> =>
    request('/projects/upgrade-state/get', { projectId }),
  upgrade: (projectId: string, input: ProjectUpgradeRequest): Promise<ProjectUpgradeResult> =>
    request('/projects/upgrade', { projectId, ...input }),
  cancelUpgrade: (projectId: string, clientRequestId: string): Promise<{ cancelled: true }> =>
    request('/projects/upgrade/cancel', { projectId, clientRequestId }),
  stack: async (projectId: string): Promise<ProjectStack> =>
    validateResolvedProjectStack(await request<unknown>('/projects/stack/get', { projectId })),
  list: (): Promise<ProjectWithPages[]> => request<ProjectWithPages[]>('/projects/list'),
  create: (input: {
    name: string;
    code: string;
    pageDirectory: string;
    directoryGrantId: string;
  }): Promise<ProjectRecord> => request<ProjectRecord>('/projects/create', input),
  open: (input: {
    name?: string;
    code?: string;
    directoryGrantId: string;
    pageDirectory: string;
    initializeIfNeeded?: boolean;
  }): Promise<OpenProjectResult> => request<OpenProjectResult>('/projects/open', input),
  rename: (projectId: string, name: string): Promise<ProjectRecord> =>
    request<ProjectRecord>('/projects/rename', { projectId, name }),
  delete: (projectId: string): Promise<{ deleted: true }> =>
    request<{ deleted: true }>('/projects/delete', { projectId, scope: 'desktop_record' }),
  pages: (projectId: string): Promise<PageRecord[]> =>
    request<PageRecord[]>('/pages/list', { projectId }),
  createPage: (projectId: string, input: { name: string; slug: string }): Promise<PageRecord> =>
    request<PageRecord>('/pages/create', { projectId, ...input }),
  renamePage: (projectId: string, pageId: string, name: string): Promise<PageRecord> =>
    request<PageRecord>('/pages/rename', { projectId, pageId, name }),
  duplicatePage: (projectId: string, pageId: string): Promise<PageRecord> =>
    request<PageRecord>('/pages/duplicate', { projectId, pageId }),
  deletePage: (projectId: string, pageId: string): Promise<{ deleted: true }> =>
    request<{ deleted: true }>('/pages/delete', { projectId, pageId, scope: 'desktop_record' }),
};
