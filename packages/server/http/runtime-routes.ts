import { RuntimeRenderReportBodySchema } from '@origamix/shared/protocol/agent';
import type { Static } from '@sinclair/typebox';
import type { RouteRegistrationContext } from './types';

export const registerRuntimeRoutes = ({ server, input, route }: RouteRegistrationContext): void => {
  if (!input.runtimeDiagnostics) return;
  const diagnostics = input.runtimeDiagnostics;
  server.post(
    '/api/v1/projects/:projectId/pages/:pageId/runtime-reports',
    { schema: { body: RuntimeRenderReportBodySchema } },
    route<Static<typeof RuntimeRenderReportBodySchema>>((request) => {
      return diagnostics.report({
        ...request.body,
        projectId: request.params.projectId,
        pageId: request.params.pageId,
      });
    }),
  );
  server.get(
    '/api/v1/projects/:projectId/pages/:pageId/runtime-state',
    route<void>((request) => diagnostics.getState(request.params.projectId, request.params.pageId)),
  );
};
