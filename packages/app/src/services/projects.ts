import {
  type PageRoleState,
  type PageRoleId,
  type UpdatePageRoles,
  type OpenProjectResult,
  type PageRecord,
  type ProjectRecord,
  type ProjectWithPages,
  validateResolvedProjectStack,
  type ProjectStack,
} from '@origamix/shared';

import { notifyPageRolesChanged } from './page-role-events';
import { request } from './request';

export const projectsService = {
  pageRoles: (projectId: string): Promise<PageRoleState> =>
    request('/projects/page-roles/get', { projectId }),
  updatePageRoles: async (input: UpdatePageRoles): Promise<PageRoleState> => {
    try {
      return await request('/projects/page-roles/update', input);
    } finally {
      notifyPageRolesChanged(input.projectId);
    }
  },
  stack: async (projectId: string): Promise<ProjectStack> =>
    validateResolvedProjectStack(await request<unknown>('/projects/stack/get', { projectId })),
  list: (): Promise<ProjectWithPages[]> => request<ProjectWithPages[]>('/projects/list'),
  create: (input: {
    layoutEnabled: boolean;
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
  createPage: async (
    projectId: string,
    input: { name: string; slug: string; role?: PageRoleId; expectedManifestHash?: string },
  ): Promise<PageRecord> => {
    try {
      return await request<PageRecord>('/pages/create', { projectId, ...input });
    } finally {
      notifyPageRolesChanged(projectId);
    }
  },
  renamePage: (projectId: string, pageId: string, name: string): Promise<PageRecord> =>
    request<PageRecord>('/pages/rename', { projectId, pageId, name }),
  duplicatePage: (projectId: string, pageId: string): Promise<PageRecord> =>
    request<PageRecord>('/pages/duplicate', { projectId, pageId }),
  deletePage: async (projectId: string, pageId: string): Promise<{ deleted: true }> => {
    try {
      return await request<{ deleted: true }>('/pages/delete', {
        projectId,
        pageId,
        scope: 'desktop_record',
      });
    } finally {
      notifyPageRolesChanged(projectId);
    }
  },
};
