import { nanoid } from 'nanoid';
import type { Static } from '@sinclair/typebox';
import {
  RestoreWorkingRevisionSchema,
  SaveWorkingRevisionSchema,
  UpdateWorkingSchemaSchema,
} from '@origamix/shared/protocol/api';
import type { ChangeSet } from '@origamix/shared/protocol/schema';
import {
  commitSchema,
  getSchema,
  getSchemaRevision,
  getWorkingSchemaState,
  restoreRevisionToWorking,
  saveWorkingRevision,
  undoSchema,
  updateWorkingSchema,
} from '../schema/schema-service';
import { invalid, notFound } from '../errors';
import type { RouteRegistrationContext } from './types';

type WithoutChangeSetId<T> = T extends unknown ? Omit<T, 'changeSetId'> : never;
type ChangeSetRequest = WithoutChangeSetId<ChangeSet>;
type SaveWorkingRevisionRequest = Static<typeof SaveWorkingRevisionSchema>;
type RestoreWorkingRevisionRequest = Static<typeof RestoreWorkingRevisionSchema>;
type UpdateWorkingSchemaRequest = Static<typeof UpdateWorkingSchemaSchema>;

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
    '/api/v1/pages/:pageId/schema',
    route<void>((request) =>
      getSchema(
        resolvePage(String(request.headers['x-origamix-project-id'] ?? ''), request.params.pageId),
      ),
    ),
  );
  server.put(
    '/api/v1/pages/:pageId/working-state',
    { schema: { body: UpdateWorkingSchemaSchema } },
    route<UpdateWorkingSchemaRequest>((request) =>
      updateWorkingSchema(
        resolvePage(String(request.headers['x-origamix-project-id'] ?? ''), request.params.pageId),
        request.body,
      ),
    ),
  );
  server.get(
    '/api/v1/pages/:pageId/working-state',
    route<void>((request) =>
      getWorkingSchemaState(
        resolvePage(String(request.headers['x-origamix-project-id'] ?? ''), request.params.pageId),
      ),
    ),
  );
  server.get(
    '/api/v1/pages/:pageId/revisions/:revisionId/schema',
    route<void>((request) =>
      getSchemaRevision(
        resolvePage(String(request.headers['x-origamix-project-id'] ?? ''), request.params.pageId),
        revisionId(request.params.revisionId),
      ),
    ),
  );
  server.post(
    '/api/v1/pages/:pageId/revisions',
    { schema: { body: SaveWorkingRevisionSchema } },
    route<SaveWorkingRevisionRequest>((request) =>
      saveWorkingRevision(
        resolvePage(String(request.headers['x-origamix-project-id'] ?? ''), request.params.pageId),
        request.body.expectedWorkingVersion,
      ),
    ),
  );
  server.post(
    '/api/v1/pages/:pageId/revisions/:revisionId/restore',
    { schema: { body: RestoreWorkingRevisionSchema } },
    route<RestoreWorkingRevisionRequest>((request) =>
      restoreRevisionToWorking(
        resolvePage(String(request.headers['x-origamix-project-id'] ?? ''), request.params.pageId),
        revisionId(request.params.revisionId),
        request.body.expectedWorkingVersion,
      ),
    ),
  );
  server.post(
    '/api/v1/pages/:pageId/changesets',
    route<ChangeSetRequest>((request) => {
      const page = resolvePage(
        String(request.headers['x-origamix-project-id'] ?? ''),
        request.params.pageId,
      );
      const changeSet = { ...request.body, changeSetId: `change_${nanoid()}` } as ChangeSet;
      if (changeSet.pageId !== page.pageId) throw invalid('变更集与页面不匹配');
      return commitSchema(page, changeSet);
    }),
  );
  server.post(
    '/api/v1/pages/:pageId/undo',
    route<void>((request) =>
      undoSchema(
        resolvePage(String(request.headers['x-origamix-project-id'] ?? ''), request.params.pageId),
      ),
    ),
  );
};
