import { RuntimeRenderReportSchema } from '@origamix/shared/protocol/agent';
import type { Static } from '@sinclair/typebox';
import { PageScopeSchema } from './body-schemas';
import type { RouteRegistrationContext } from './types';

export const registerRuntimeRoutes = ({ server, input, route }: RouteRegistrationContext): void => {
  if (!input.runtimeDiagnostics) return;
  const diagnostics = input.runtimeDiagnostics;
  server.post(
    '/api/v1/pages/runtime-reports/report',
    { schema: { body: RuntimeRenderReportSchema } },
    route<Static<typeof RuntimeRenderReportSchema>>((request) => diagnostics.report(request.body)),
  );
  server.post(
    '/api/v1/pages/runtime-state/get',
    { schema: { body: PageScopeSchema } },
    route<Static<typeof PageScopeSchema>>((request) =>
      diagnostics.getState(request.body.projectId, request.body.pageId),
    ),
  );
};
