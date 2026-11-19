import type { Static } from '@sinclair/typebox';
import { ProjectScopeSchema } from './body-schemas';
import type { RouteRegistrationContext } from './types';

export const registerProjectExportRoutes = ({ server, input, route }: RouteRegistrationContext) => {
  if (input.host !== 'web') return;
  const exportProject = input.exportProject;
  if (!exportProject) return;
  server.post(
    '/api/v1/projects/export/snapshot',
    { schema: { body: ProjectScopeSchema } },
    route<Static<typeof ProjectScopeSchema>>(({ body }) => exportProject(body.projectId)),
  );
};
