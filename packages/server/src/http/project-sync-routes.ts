import { Type, type Static } from '@sinclair/typebox';
import { ProjectScopeSchema, withProjectScope } from './body-schemas';
import type { RouteRegistrationContext } from './types';

const TargetSchema = Type.Object({
  targetId: Type.String({ pattern: '^target_[A-Za-z0-9_-]{16,48}$' }),
});
const PrepareSchema = withProjectScope(TargetSchema);
const FinishSchema = withProjectScope(
  Type.Object({
    ...TargetSchema.properties,
    snapshotId: Type.String({ pattern: '^sync_[A-Za-z0-9_-]{1,48}$' }),
  }),
);

export const registerProjectSyncRoutes = ({ server, input, route }: RouteRegistrationContext) => {
  const sync = input.projectSync;
  if (!sync) return;
  server.post(
    '/api/v1/projects/sync/identity',
    { schema: { body: ProjectScopeSchema } },
    route<Static<typeof ProjectScopeSchema>>(({ body }) => sync.identity(body.projectId)),
  );
  server.post(
    '/api/v1/projects/sync/prepare',
    { schema: { body: PrepareSchema } },
    route<Static<typeof PrepareSchema>>(({ body }) => sync.prepare(body.projectId, body.targetId)),
  );
  server.post(
    '/api/v1/projects/sync/finish',
    { schema: { body: FinishSchema } },
    route<Static<typeof FinishSchema>>(({ body }) =>
      sync.finish(body.projectId, body.targetId, body.snapshotId),
    ),
  );
  server.post(
    '/api/v1/projects/export/snapshot',
    { schema: { body: ProjectScopeSchema } },
    route<Static<typeof ProjectScopeSchema>>(({ body }) => sync.export(body.projectId)),
  );
};
