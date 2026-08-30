import type { WorkspaceRecord } from '../../../shared/protocol/api';
import { request } from './request';

export const workspaceService = {
  get: (): Promise<WorkspaceRecord> => request<WorkspaceRecord>('/workspace'),
  save: (input: Partial<Omit<WorkspaceRecord, 'updatedAt'>>): Promise<WorkspaceRecord> =>
    request<WorkspaceRecord>('/workspace', { method: 'PATCH', body: JSON.stringify(input) })
};
