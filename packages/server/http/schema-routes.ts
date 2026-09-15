import { nanoid } from 'nanoid';
import type { ChangeSet } from '@origamix/shared/protocol/schema';
import { commitSchema, getSchema, getSchemaRevision, undoSchema } from '../schema/schema-service';
import { invalid, notFound } from '../errors';
import type { RouteRegistrationContext } from './types';

type WithoutChangeSetId<T> = T extends unknown ? Omit<T, 'changeSetId'> : never;
type ChangeSetRequest = WithoutChangeSetId<ChangeSet>;

export const registerSchemaRoutes = ({ server, input, route }: RouteRegistrationContext): void => {
  const resolvePage = (projectId: string, pageId: string) => {
    const page = input.projects.getPage(projectId, pageId);
    const project = input.projects.getProject(projectId);
    if (!page || !project) throw notFound('页面不存在');
    return { projectPath: project.path, pageId: page.id, slug: page.slug };
  };
  server.get(
    '/api/v1/pages/:pageId/schema',
    route<void>((request) =>
      getSchema(
        resolvePage(String(request.headers['x-origamix-project-id'] ?? ''), request.params.pageId),
      ),
    ),
  );
  server.get(
    '/api/v1/pages/:pageId/revisions/:revisionId/schema',
    route<void>((request) =>
      getSchemaRevision(
        resolvePage(String(request.headers['x-origamix-project-id'] ?? ''), request.params.pageId),
        request.params.revisionId,
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
