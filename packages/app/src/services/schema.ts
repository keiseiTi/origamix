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
    request<SchemaResult>('/pages/schema/get', { projectId, pageId }),
  workingState: (projectId: string, pageId: string): Promise<WorkingSchemaResult> =>
    request<WorkingSchemaResult>('/pages/working-state/get', { projectId, pageId }),
  listRevisions: (projectId: string, pageId: string): Promise<RevisionHistory> =>
    request<RevisionHistory>('/pages/revisions/list', { projectId, pageId }),
  getRevision: (projectId: string, pageId: string, revisionId: string): Promise<SchemaResult> =>
    request<SchemaResult>('/pages/revisions/schema/get', { projectId, pageId, revisionId }),
  updateWorking: (
    projectId: string,
    pageId: string,
    baseWorkingVersion: number,
    schema: OrigamixPageSchema,
  ): Promise<WorkingSchemaResult> =>
    request<WorkingSchemaResult>('/pages/working-state/update', {
      projectId,
      pageId,
      baseWorkingVersion,
      schema,
    }),
  applyWorkingOperations: (
    projectId: string,
    pageId: string,
    baseWorkingVersion: number,
    operations: readonly SchemaOperation[],
  ): Promise<WorkingSchemaResult> =>
    request<WorkingSchemaResult>('/pages/working-operations/apply', {
      projectId,
      pageId,
      baseWorkingVersion,
      operations,
    }),
  saveRevision: (
    projectId: string,
    pageId: string,
    expectedWorkingVersion: number,
  ): Promise<WorkingSchemaResult> =>
    request<WorkingSchemaResult>('/pages/revisions/save', {
      projectId,
      pageId,
      expectedWorkingVersion,
    }),
  restoreRevision: (
    projectId: string,
    pageId: string,
    revisionId: string,
    expectedWorkingVersion: number,
  ): Promise<WorkingSchemaResult> =>
    request<WorkingSchemaResult>('/pages/revisions/restore', {
      projectId,
      pageId,
      revisionId,
      expectedWorkingVersion,
    }),
  applyState: (projectId: string, pageId: string): Promise<PageApplyState> =>
    request<PageApplyState>('/pages/apply-state/get', { projectId, pageId }, isPageApplyState),
  reloadFromProject: (projectId: string, pageId: string): Promise<SchemaResult> =>
    request<SchemaResult>('/pages/reload-from-project', { projectId, pageId }),
  apply: (
    projectId: string,
    pageId: string,
    expectedRevisionId: string,
    expectedWorkingVersion: number,
    clientRequestId: string = crypto.randomUUID(),
  ): Promise<ApplyPageResult> =>
    request<ApplyPageResult>(
      '/pages/apply',
      {
        projectId,
        pageId,
        expectedRevisionId,
        expectedWorkingVersion,
        clientRequestId,
      },
      isApplyPageResult,
    ),
};
