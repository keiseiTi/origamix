import { Type, type Static } from '@sinclair/typebox';
import {
  ApplyWorkingOperationsSchema,
  RestoreWorkingRevisionSchema,
  SaveWorkingRevisionSchema,
  UpdateWorkingSchemaSchema,
} from '@origamix/shared/protocol/api';
import { RevisionIdSchema } from '@origamix/shared/protocol/schema';
import {
  applyWorkingSchemaOperations,
  getSchema,
  getSchemaRevision,
  getWorkingSchemaState,
  listRevisionHistory,
  restoreRevisionToWorking,
  saveWorkingRevision,
  updateWorkingSchema,
} from '../schema/schema-service';
import { invalid, notFound } from '../errors';
import { PageScopeSchema, withPageScope } from './body-schemas';
import type { RouteRegistrationContext } from './types';

const RevisionScopeSchema = Type.Object(
  { ...PageScopeSchema.properties, revisionId: RevisionIdSchema },
  { additionalProperties: false },
);
const WorkingOperationsBodySchema = withPageScope(ApplyWorkingOperationsSchema);
const WorkingUpdateBodySchema = withPageScope(UpdateWorkingSchemaSchema);
const SaveRevisionBodySchema = withPageScope(SaveWorkingRevisionSchema);
const RestoreRevisionBodySchema = Type.Object(
  { ...withPageScope(RestoreWorkingRevisionSchema).properties, revisionId: RevisionIdSchema },
  { additionalProperties: false },
);

export const registerSchemaRoutes = ({ server, input, route }: RouteRegistrationContext): void => {
  const resolvePage = (projectId: string, pageId: string) => {
    const page = input.projects.getPage(projectId, pageId);
    const project = input.projects.getProject(projectId);
    if (!page || !project) throw notFound('页面不存在');
    return {
      projectPath: project.path,
      pageId: page.id,
      slug: page.slug,
      relativePath: page.relativePath,
    };
  };
  server.post(
    '/api/v1/pages/schema/get',
    { schema: { body: PageScopeSchema } },
    route<Static<typeof PageScopeSchema>>((request) =>
      getSchema(resolvePage(request.body.projectId, request.body.pageId)),
    ),
  );
  server.post(
    '/api/v1/pages/working-operations/apply',
    { schema: { body: WorkingOperationsBodySchema } },
    route<Static<typeof WorkingOperationsBodySchema>>(async (request) => {
      const { projectId, pageId, ...body } = request.body;
      try {
        return await applyWorkingSchemaOperations(resolvePage(projectId, pageId), body);
      } catch (error) {
        if (error instanceof Error && error.name === 'SchemaOperationError')
          throw invalid(error.message);
        throw error;
      }
    }),
  );
  server.post(
    '/api/v1/pages/working-state/update',
    { schema: { body: WorkingUpdateBodySchema } },
    route<Static<typeof WorkingUpdateBodySchema>>((request) => {
      const { projectId, pageId, ...body } = request.body;
      return updateWorkingSchema(resolvePage(projectId, pageId), body);
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
