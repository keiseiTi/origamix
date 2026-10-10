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
    request<SchemaResult>(
      `/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}/schema`,
    ),
  workingState: (projectId: string, pageId: string): Promise<WorkingSchemaResult> =>
    request<WorkingSchemaResult>(
      `/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}/working-state`,
    ),
  listRevisions: (projectId: string, pageId: string): Promise<RevisionHistory> =>
    request<RevisionHistory>(
      `/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}/revisions`,
    ),
  getRevision: (projectId: string, pageId: string, revisionId: string): Promise<SchemaResult> =>
    request<SchemaResult>(
      `/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}/revisions/${revisionId}/schema`,
    ),
  updateWorking: (
    projectId: string,
    pageId: string,
    baseWorkingVersion: number,
    schema: OrigamixPageSchema,
  ): Promise<WorkingSchemaResult> =>
    request<WorkingSchemaResult>(
      `/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}/working-state`,
      {
        method: 'PUT',
        body: JSON.stringify({ baseWorkingVersion, schema }),
      },
    ),
  applyWorkingOperations: (
    projectId: string,
    pageId: string,
    baseWorkingVersion: number,
    operations: readonly SchemaOperation[],
  ): Promise<WorkingSchemaResult> =>
    request<WorkingSchemaResult>(
      `/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}/working-operations`,
      {
        method: 'POST',
        body: JSON.stringify({ baseWorkingVersion, operations }),
      },
    ),
  saveRevision: (
    projectId: string,
    pageId: string,
    expectedWorkingVersion: number,
  ): Promise<WorkingSchemaResult> =>
    request<WorkingSchemaResult>(
      `/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}/revisions`,
      {
        method: 'POST',
        body: JSON.stringify({ expectedWorkingVersion }),
      },
    ),
  restoreRevision: (
    projectId: string,
    pageId: string,
    revisionId: string,
    expectedWorkingVersion: number,
  ): Promise<WorkingSchemaResult> =>
    request<WorkingSchemaResult>(
      `/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}/revisions/${revisionId}/restore`,
      {
        method: 'POST',
        body: JSON.stringify({ expectedWorkingVersion }),
      },
    ),
  applyState: (projectId: string, pageId: string): Promise<PageApplyState> =>
    request<PageApplyState>(
      `/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}/apply-state`,
      undefined,
      isPageApplyState,
    ),
  reloadFromProject: (projectId: string, pageId: string): Promise<SchemaResult> =>
    request<SchemaResult>(
      `/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}/reload-from-project`,
      {
        method: 'POST',
      },
    ),
  apply: (
    projectId: string,
    pageId: string,
    expectedRevisionId: string,
    expectedWorkingVersion: number,
    clientRequestId: string = crypto.randomUUID(),
  ): Promise<ApplyPageResult> =>
    request<ApplyPageResult>(
      `/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}/apply`,
      {
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
