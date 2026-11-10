import {
  ProjectPreviewScopeSchema,
  ProjectPreviewSessionSchema,
  type ProjectPreviewSession,
} from '@origamix/shared';
import type { RouteRegistrationContext } from './types';
export const registerProjectPreviewRoutes = ({
  server,
  input,
  route,
}: RouteRegistrationContext): void => {
  const preview = input.projectPreview;
  if (!preview) return;
  server.post(
    '/api/v1/projects/preview/open',
    { schema: { body: ProjectPreviewScopeSchema } },
    route<{ projectId: string }>(({ body }) => preview.open(body.projectId)),
  );
  server.post(
    '/api/v1/projects/preview/status',
    { schema: { body: ProjectPreviewSessionSchema } },
    route<ProjectPreviewSession>(({ body }) => preview.status(body)),
  );
  server.post(
    '/api/v1/projects/preview/close',
    { schema: { body: ProjectPreviewSessionSchema } },
    route<ProjectPreviewSession>(async ({ body }) => {
      await preview.end(body);
      return null;
    }),
  );
};
