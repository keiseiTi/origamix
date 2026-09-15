import {
  RuntimeRenderReportSchema,
  type RuntimeRenderReport,
} from '@origamix/shared/protocol/agent';
import { invalid } from '../errors';
import type { RouteRegistrationContext } from './types';

export const registerRuntimeRoutes = ({ server, input, route }: RouteRegistrationContext): void => {
  if (!input.runtimeDiagnostics) return;
  const diagnostics = input.runtimeDiagnostics;
  server.post(
    '/api/v1/pages/:pageId/runtime-reports',
    { schema: { body: RuntimeRenderReportSchema } },
    route<RuntimeRenderReport>((request) => {
      const projectId = String(request.headers['x-origamix-project-id'] ?? '');
      if (request.body.projectId !== projectId || request.body.pageId !== request.params.pageId)
        throw invalid('Runtime 报告归属不匹配');
      return diagnostics.report(request.body);
    }),
  );
  server.get(
    '/api/v1/pages/:pageId/runtime-state',
    route<void>((request) =>
      diagnostics.getState(
        String(request.headers['x-origamix-project-id'] ?? ''),
        request.params.pageId,
      ),
    ),
  );
};
