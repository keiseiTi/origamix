import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import {
  isApplyPageResult,
  isPageApplyState,
  type ApplyPageResult,
  type PageApplyState,
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
  updateProps: (
    projectId: string,
    pageId: string,
    input: { baseRevisionId: string; elementId: string; props: Record<string, unknown> },
  ): Promise<SchemaResult> =>
    request<SchemaResult>(`/pages/${pageId}/changesets`, {
      projectId,
      method: 'POST',
      body: JSON.stringify({
        pageId,
        baseRevisionId: input.baseRevisionId,
        source: { kind: 'user' },
        createdAt: new Date().toISOString(),
        operation: 'updateElementProps',
        elementId: input.elementId,
        props: input.props,
      }),
    }),
  replace: (
    projectId: string,
    pageId: string,
    input: { baseRevisionId: string; schema: OrigamixPageSchema },
  ): Promise<SchemaResult> =>
    request<SchemaResult>(`/pages/${pageId}/changesets`, {
      projectId,
      method: 'POST',
      body: JSON.stringify({
        pageId,
        baseRevisionId: input.baseRevisionId,
        source: { kind: 'user' },
        createdAt: new Date().toISOString(),
        operation: 'replaceSchema',
        schema: input.schema,
      }),
    }),
  undo: (projectId: string, pageId: string): Promise<SchemaResult> =>
    request<SchemaResult>(`/pages/${pageId}/undo`, { projectId, method: 'POST' }),
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
