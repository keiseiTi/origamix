import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { request } from './request';

interface SchemaResult {
  schema: OrigamixPageSchema;
  revisionId: string;
}

export const schemaService = {
  get: (projectId: string, pageId: string): Promise<SchemaResult> =>
    request<SchemaResult>(`/pages/${pageId}/schema`, { projectId }),
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
  undo: (projectId: string, pageId: string): Promise<SchemaResult> =>
    request<SchemaResult>(`/pages/${pageId}/undo`, { projectId, method: 'POST' }),
};
