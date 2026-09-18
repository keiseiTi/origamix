import type { OrigamixPageSchema, SchemaOperation } from '@origamix/shared/protocol/schema';
import {
  isApplyPageResult,
  isPageApplyState,
  type ApplyPageResult,
  type PageApplyState,
  type RevisionHistory,
} from '@origamix/shared/protocol/api';
import { request } from './request';

interface SchemaResult {
  schema: OrigamixPageSchema;
  revisionId: string;
}

interface WorkingSchemaResult extends SchemaResult {
  workingVersion: number;
  workingHash: string;
  savedSchemaHash: string;
  baselineHash: string;
}

export const schemaService = {
  get: (projectId: string, pageId: string): Promise<SchemaResult> =>
    request<SchemaResult>(`/pages/${pageId}/schema`, { projectId }),
  workingState: (projectId: string, pageId: string): Promise<WorkingSchemaResult> =>
    request<WorkingSchemaResult>(`/pages/${pageId}/working-state`, { projectId }),
  listRevisions: (projectId: string, pageId: string): Promise<RevisionHistory> =>
    request<RevisionHistory>(`/pages/${pageId}/revisions`, { projectId }),
  getRevision: (projectId: string, pageId: string, revisionId: string): Promise<SchemaResult> =>
    request<SchemaResult>(`/pages/${pageId}/revisions/${revisionId}/schema`, { projectId }),
  updateWorking: (
    projectId: string,
    pageId: string,
    baseWorkingVersion: number,
    schema: OrigamixPageSchema,
  ): Promise<WorkingSchemaResult> =>
    request<WorkingSchemaResult>(`/pages/${pageId}/working-state`, {
      projectId,
      method: 'PUT',
      body: JSON.stringify({ baseWorkingVersion, schema }),
    }),
  applyWorkingOperations: (
    projectId: string,
    pageId: string,
    baseWorkingVersion: number,
    operations: readonly SchemaOperation[],
  ): Promise<WorkingSchemaResult> =>
    request<WorkingSchemaResult>(`/pages/${pageId}/working-operations`, {
      projectId,
      method: 'POST',
      body: JSON.stringify({ baseWorkingVersion, operations }),
    }),
  saveRevision: (
    projectId: string,
    pageId: string,
    expectedWorkingVersion: number,
  ): Promise<WorkingSchemaResult> =>
    request<WorkingSchemaResult>(`/pages/${pageId}/revisions`, {
      projectId,
      method: 'POST',
      body: JSON.stringify({ expectedWorkingVersion }),
    }),
  restoreRevision: (
    projectId: string,
    pageId: string,
    revisionId: string,
    expectedWorkingVersion: number,
  ): Promise<WorkingSchemaResult> =>
    request<WorkingSchemaResult>(`/pages/${pageId}/revisions/${revisionId}/restore`, {
      projectId,
      method: 'POST',
      body: JSON.stringify({ expectedWorkingVersion }),
    }),
  applyState: (projectId: string, pageId: string): Promise<PageApplyState> =>
    request<PageApplyState>(`/pages/${pageId}/apply-state`, { projectId }, isPageApplyState),
  reloadFromProject: (projectId: string, pageId: string): Promise<SchemaResult> =>
    request<SchemaResult>(`/pages/${pageId}/reload-from-project`, {
      projectId,
      method: 'POST',
    }),
  apply: (
    projectId: string,
    pageId: string,
    expectedRevisionId: string,
    expectedWorkingVersion: number,
    clientRequestId: string = crypto.randomUUID(),
  ): Promise<ApplyPageResult> =>
    request<ApplyPageResult>(
      `/pages/${pageId}/apply`,
      {
        projectId,
        method: 'POST',
        body: JSON.stringify({
          expectedRevisionId,
          expectedWorkingVersion,
          clientRequestId,
        }),
      },
      isApplyPageResult,
    ),
};
