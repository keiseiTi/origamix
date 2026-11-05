import type { Static } from '@sinclair/typebox';
import {
  LayoutScopeSchema,
  LayoutApplyRequestSchema,
  LayoutConfigRequestSchema,
  LayoutConfigUpdateRequestSchema,
  LayoutOperationsRequestSchema,
  LayoutSaveRevisionRequestSchema,
  LayoutRevisionRequestSchema,
  LayoutRestoreRevisionRequestSchema,
} from '@origamix/shared';
import type { RouteRegistrationContext } from './types';

export const registerLayoutRoutes = ({ server, input, route }: RouteRegistrationContext): void => {
  server.post(
    '/api/v1/layout/config/get',
    { schema: { body: LayoutConfigRequestSchema } },
    route<Static<typeof LayoutConfigRequestSchema>>(({ body }) =>
      input.projectService.getLayoutConfig(body.projectId),
    ),
  );
  server.post(
    '/api/v1/layout/config/update',
    { schema: { body: LayoutConfigUpdateRequestSchema } },
    route<Static<typeof LayoutConfigUpdateRequestSchema>>(({ body }) =>
      input.projectService.setLayoutEnabled(body.projectId, body.enabled),
    ),
  );
  const apply = input.projectApplyService;
  if (apply) {
    server.post(
      '/api/v1/layout/apply',
      { schema: { body: LayoutApplyRequestSchema } },
      route<Static<typeof LayoutApplyRequestSchema>>(({ body }) => apply.applyLayout(body)),
    );
    server.post(
      '/api/v1/layout/apply-state/get',
      { schema: { body: LayoutScopeSchema } },
      route<Static<typeof LayoutScopeSchema>>(({ body }) => apply.getLayoutState(body.projectId)),
    );
  }
  const layout = input.layoutService;
  if (!layout) return;
  server.post(
    '/api/v1/layout/working/get',
    { schema: { body: LayoutScopeSchema } },
    route<Static<typeof LayoutScopeSchema>>(({ body }) => layout.getWorking(body.projectId)),
  );
  server.post(
    '/api/v1/layout/working/operations',
    { schema: { body: LayoutOperationsRequestSchema } },
    route<Static<typeof LayoutOperationsRequestSchema>>(({ body }) => layout.applyOperations(body)),
  );
  server.post(
    '/api/v1/layout/revisions/save',
    { schema: { body: LayoutSaveRevisionRequestSchema } },
    route<Static<typeof LayoutSaveRevisionRequestSchema>>(({ body }) =>
      layout.saveRevision(body.projectId, body.expectedWorkingVersion),
    ),
  );
  server.post(
    '/api/v1/layout/revisions/list',
    { schema: { body: LayoutScopeSchema } },
    route<Static<typeof LayoutScopeSchema>>(({ body }) => layout.listRevisions(body.projectId)),
  );
  server.post(
    '/api/v1/layout/revisions/get',
    { schema: { body: LayoutRevisionRequestSchema } },
    route<Static<typeof LayoutRevisionRequestSchema>>(({ body }) =>
      layout.getRevision(body.projectId, body.revisionId),
    ),
  );
  server.post(
    '/api/v1/layout/revisions/restore',
    { schema: { body: LayoutRestoreRevisionRequestSchema } },
    route<Static<typeof LayoutRestoreRevisionRequestSchema>>(({ body }) =>
      layout.restoreRevision(body.projectId, body.revisionId, body.expectedWorkingVersion),
    ),
  );
};
