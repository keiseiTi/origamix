import type { RuntimeRenderReport, RuntimeReportResult } from '@origamix/shared/protocol/agent';
import { request } from './request';

export const runtimeService = {
  report: (
    projectId: string,
    pageId: string,
    report: Omit<RuntimeRenderReport, 'version' | 'projectId' | 'pageId'>,
  ): Promise<RuntimeReportResult> =>
    request<RuntimeReportResult>(`/pages/${pageId}/runtime-reports`, {
      projectId,
      method: 'POST',
      body: JSON.stringify({
        version: '1',
        projectId,
        pageId,
        ...report,
        diagnostics: report.diagnostics.map((diagnostic) => ({
          ...diagnostic,
          pageId,
          revisionId: report.revisionId,
        })),
      }),
    }),
};
