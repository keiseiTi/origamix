import { notifyProjectPagesChanged } from './project-page-events';
import type { ProjectNavigationInfo } from '@origamix/shared';
import {
  type PageRoleState,
  type ProjectSettings,
  type ProjectSettingsUpdate,
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

export const workbenchHost = () => __ORIGAMIX_WORKBENCH_HOST__;

type WorkbenchProject = Omit<ProjectRecord, 'path'> & { path?: string };
type WorkbenchProjectWithPages = WorkbenchProject & Pick<ProjectWithPages, 'pages'>;

export const projectsService = {
  settings: (projectId: string): Promise<ProjectSettings> =>
    request('/projects/settings/get', { projectId }),
  updateSettings: (input: ProjectSettingsUpdate): Promise<ProjectSettings> =>
    request('/projects/settings/update', input),
  navigation: (projectId: string): Promise<ProjectNavigationInfo> =>
    request('/projects/navigation/get', { projectId }),
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
  list: (): Promise<WorkbenchProjectWithPages[]> =>
    request<WorkbenchProjectWithPages[]>('/projects/list'),
  create: (input: {
    layoutEnabled: boolean;
    name: string;
    code: string;
    pageDirectory: string;
    directoryGrantId?: string;
  }): Promise<WorkbenchProject> => request<WorkbenchProject>('/projects/create', input),
  open: (input: {
    name?: string;
    code?: string;
    directoryGrantId: string;
    pageDirectory?: string;
    initializeIfNeeded?: boolean;
  }): Promise<OpenProjectResult> => request<OpenProjectResult>('/projects/open', input),
  rename: (projectId: string, name: string): Promise<WorkbenchProject> =>
    request<WorkbenchProject>('/projects/rename', { projectId, name }),
  delete: (projectId: string): Promise<{ deleted: true }> =>
    request<{ deleted: true }>('/projects/delete', { projectId }),
  pages: (projectId: string): Promise<PageRecord[]> =>
    request<PageRecord[]>('/pages/list', { projectId }),
  createPage: async (
    projectId: string,
    input: { name: string; slug: string; role?: PageRoleId },
  ): Promise<PageRecord> => {
    try {
      return await request<PageRecord>('/pages/create', { projectId, ...input });
    } finally {
      notifyPageRolesChanged(projectId);
      notifyProjectPagesChanged(projectId);
    }
  },
  renamePage: async (projectId: string, pageId: string, name: string): Promise<PageRecord> => {
    const page = await request<PageRecord>('/pages/rename', { projectId, pageId, name });
    notifyProjectPagesChanged(projectId);
    return page;
  },
  duplicatePage: async (projectId: string, pageId: string): Promise<PageRecord> => {
    const page = await request<PageRecord>('/pages/duplicate', { projectId, pageId });
    notifyProjectPagesChanged(projectId);
    return page;
  },
  deletePage: async (projectId: string, pageId: string): Promise<{ deleted: true }> => {
    try {
      return await request<{ deleted: true }>('/pages/delete', {
        projectId,
        pageId,
      });
    } finally {
      notifyPageRolesChanged(projectId);
      notifyProjectPagesChanged(projectId);
    }
  },
};
