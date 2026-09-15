import type { Static } from '@sinclair/typebox';
import { ApplyPageSchema } from '@origamix/shared/protocol/api';
import type { RouteRegistrationContext } from './types';

type ApplyPage = Static<typeof ApplyPageSchema>;

export const registerApplyRoutes = ({ server, input, route }: RouteRegistrationContext): void => {
  if (!input.projectApplyService) return;
  const projectApply = input.projectApplyService;
  server.get(
    '/api/v1/pages/:pageId/apply-state',
    route<void>((request) =>
      projectApply.getState(
        String(request.headers['x-origamix-project-id'] ?? ''),
        request.params.pageId,
      ),
    ),
  );
  server.post(
    '/api/v1/pages/:pageId/apply',
    { schema: { body: ApplyPageSchema } },
    route<ApplyPage>((request) =>
      projectApply.apply(
        String(request.headers['x-origamix-project-id'] ?? ''),
        request.params.pageId,
        request.body,
      ),
    ),
  );
  server.post(
    '/api/v1/pages/:pageId/reload-from-project',
    route<void>((request) =>
      projectApply.reloadFromProject(
        String(request.headers['x-origamix-project-id'] ?? ''),
        request.params.pageId,
      ),
    ),
  );
};
