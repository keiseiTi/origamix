import type { Static } from '@sinclair/typebox';
import {
  ApplyWorkingOperationsSchema,
  RestoreWorkingRevisionSchema,
  SaveWorkingRevisionSchema,
  UpdateWorkingSchemaSchema,
} from '@origamix/shared/protocol/api';
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
import type { RouteRegistrationContext } from './types';

type SaveWorkingRevisionRequest = Static<typeof SaveWorkingRevisionSchema>;
type RestoreWorkingRevisionRequest = Static<typeof RestoreWorkingRevisionSchema>;
type UpdateWorkingSchemaRequest = Static<typeof UpdateWorkingSchemaSchema>;
type ApplyWorkingOperationsRequest = Static<typeof ApplyWorkingOperationsSchema>;

export const registerSchemaRoutes = ({ server, input, route }: RouteRegistrationContext): void => {
  const revisionId = (value: string): string => {
    if (!/^revision_[A-Za-z0-9_-]+$/.test(value)) throw invalid('Revision ID 无效');
    return value;
  };
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
  server.get(
    '/api/v1/projects/:projectId/pages/:pageId/schema',
    route<void>((request) =>
      getSchema(resolvePage(request.params.projectId, request.params.pageId)),
    ),
  );
  server.post(
    '/api/v1/projects/:projectId/pages/:pageId/working-operations',
    { schema: { body: ApplyWorkingOperationsSchema } },
    route<ApplyWorkingOperationsRequest>(async (request) => {
      try {
        return await applyWorkingSchemaOperations(
          resolvePage(request.params.projectId, request.params.pageId),
          request.body,
        );
      } catch (error) {
        if (error instanceof Error && error.name === 'SchemaOperationError')
          throw invalid(error.message);
        throw error;
      }
    }),
  );
  server.put(
    '/api/v1/projects/:projectId/pages/:pageId/working-state',
    { schema: { body: UpdateWorkingSchemaSchema } },
    route<UpdateWorkingSchemaRequest>((request) =>
      updateWorkingSchema(
        resolvePage(request.params.projectId, request.params.pageId),
        request.body,
      ),
    ),
  );
  server.get(
    '/api/v1/projects/:projectId/pages/:pageId/working-state',
    route<void>((request) =>
      getWorkingSchemaState(resolvePage(request.params.projectId, request.params.pageId)),
    ),
  );
  server.get(
    '/api/v1/projects/:projectId/pages/:pageId/revisions',
    route<void>((request) =>
      listRevisionHistory(resolvePage(request.params.projectId, request.params.pageId)),
    ),
  );
  server.get(
    '/api/v1/projects/:projectId/pages/:pageId/revisions/:revisionId/schema',
    route<void>((request) =>
      getSchemaRevision(
        resolvePage(request.params.projectId, request.params.pageId),
        revisionId(request.params.revisionId),
      ),
    ),
  );
  server.post(
    '/api/v1/projects/:projectId/pages/:pageId/revisions',
    { schema: { body: SaveWorkingRevisionSchema } },
    route<SaveWorkingRevisionRequest>((request) =>
      saveWorkingRevision(
        resolvePage(request.params.projectId, request.params.pageId),
        request.body.expectedWorkingVersion,
      ),
    ),
  );
  server.post(
    '/api/v1/projects/:projectId/pages/:pageId/revisions/:revisionId/restore',
    { schema: { body: RestoreWorkingRevisionSchema } },
    route<RestoreWorkingRevisionRequest>((request) =>
      restoreRevisionToWorking(
        resolvePage(request.params.projectId, request.params.pageId),
        revisionId(request.params.revisionId),
        request.body.expectedWorkingVersion,
      ),
    ),
  );
};
