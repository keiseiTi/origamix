import type { Static } from '@sinclair/typebox';
import { ApplyPageSchema } from '@origamix/shared/protocol/api';
import { PageScopeSchema, withPageScope } from './body-schemas';
import type { RouteRegistrationContext } from './types';

const ApplyBodySchema = withPageScope(ApplyPageSchema);

export const registerApplyRoutes = ({ server, input, route }: RouteRegistrationContext): void => {
  if (!input.projectApplyService) return;
  const projectApply = input.projectApplyService;
  server.post(
    '/api/v1/pages/apply-state/get',
    { schema: { body: PageScopeSchema } },
    route<Static<typeof PageScopeSchema>>((request) =>
      projectApply.getState(request.body.projectId, request.body.pageId),
    ),
  );
  server.post(
    '/api/v1/pages/apply',
    { schema: { body: ApplyBodySchema } },
    route<Static<typeof ApplyBodySchema>>((request) => {
      const { projectId, pageId, ...body } = request.body;
      return projectApply.apply(projectId, pageId, body);
    }),
  );
  server.post(
    '/api/v1/pages/reload-from-project',
    { schema: { body: PageScopeSchema } },
    route<Static<typeof PageScopeSchema>>((request) =>
      projectApply.reloadFromProject(request.body.projectId, request.body.pageId),
    ),
  );
};
