import { Type, type Static } from '@sinclair/typebox';
import {
  ApplyWorkingOperationsSchema,
  RestoreWorkingRevisionSchema,
  SaveWorkingRevisionSchema,
  RevisionIdSchema,
} from '@origamix/shared';

import {
  applyWorkingSchemaOperations,
  getSchemaRevision,
  getWorkingSchemaState,
  listRevisionHistory,
  restoreRevisionToWorking,
  saveWorkingRevision,
  fileSchemaPageResolver,
} from '../schema/schema-service';
import { invalid } from '../errors';
import { PageScopeSchema, withPageScope } from './body-schemas';
import type { RouteRegistrationContext } from './types';

const RevisionScopeSchema = Type.Object(
  { ...PageScopeSchema.properties, revisionId: RevisionIdSchema },
  { additionalProperties: false },
);
const WorkingOperationsBodySchema = withPageScope(ApplyWorkingOperationsSchema);
const SaveRevisionBodySchema = withPageScope(SaveWorkingRevisionSchema);
const RestoreRevisionBodySchema = Type.Object(
  { ...withPageScope(RestoreWorkingRevisionSchema).properties, revisionId: RevisionIdSchema },
  { additionalProperties: false },
);

export const registerSchemaRoutes = ({ server, input, route }: RouteRegistrationContext): void => {
  const resolvePage = input.resolveSchemaPage ?? fileSchemaPageResolver(input.projects);

  server.post(
    '/api/v1/pages/working-operations/apply',
    { schema: { body: WorkingOperationsBodySchema } },
    route<Static<typeof WorkingOperationsBodySchema>>(async (request) => {
      const { projectId, pageId, ...body } = request.body;
      try {
        return await applyWorkingSchemaOperations(resolvePage(projectId, pageId), body, {
          diagnostics: { logger: input.logger, requestId: request.requestId },
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'SchemaOperationError')
          throw invalid(error.message);
        throw error;
      }
    }),
  );
  server.post(
    '/api/v1/pages/working-state/get',
    { schema: { body: PageScopeSchema } },
    route<Static<typeof PageScopeSchema>>((request) =>
      getWorkingSchemaState(resolvePage(request.body.projectId, request.body.pageId)),
    ),
  );
  server.post(
    '/api/v1/pages/revisions/list',
    { schema: { body: PageScopeSchema } },
    route<Static<typeof PageScopeSchema>>((request) =>
      listRevisionHistory(resolvePage(request.body.projectId, request.body.pageId)),
    ),
  );
  server.post(
    '/api/v1/pages/revisions/schema/get',
    { schema: { body: RevisionScopeSchema } },
    route<Static<typeof RevisionScopeSchema>>((request) =>
      getSchemaRevision(
        resolvePage(request.body.projectId, request.body.pageId),
        request.body.revisionId,
      ),
    ),
  );
  server.post(
    '/api/v1/pages/revisions/save',
    { schema: { body: SaveRevisionBodySchema } },
    route<Static<typeof SaveRevisionBodySchema>>((request) =>
      saveWorkingRevision(
        resolvePage(request.body.projectId, request.body.pageId),
        request.body.expectedWorkingVersion,
      ),
    ),
  );
  server.post(
    '/api/v1/pages/revisions/restore',
    { schema: { body: RestoreRevisionBodySchema } },
    route<Static<typeof RestoreRevisionBodySchema>>((request) =>
      restoreRevisionToWorking(
        resolvePage(request.body.projectId, request.body.pageId),
        request.body.revisionId,
        request.body.expectedWorkingVersion,
      ),
    ),
  );
};
