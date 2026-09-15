import type { Static } from '@sinclair/typebox';
import {
  CreatePageSchema,
  CreateProjectSchema,
  DeleteDesktopRecordSchema,
  DuplicatePageSchema,
  OpenProjectSchema,
  RenamePageSchema,
  RenameProjectSchema,
} from '@origamix/shared/protocol/api';
import type { RouteRegistrationContext } from './types';

type CreateProject = Static<typeof CreateProjectSchema>;
type OpenProject = Static<typeof OpenProjectSchema>;
type CreatePage = Static<typeof CreatePageSchema>;
type RenameProject = Static<typeof RenameProjectSchema>;
type RenamePage = Static<typeof RenamePageSchema>;
type DuplicatePage = Static<typeof DuplicatePageSchema>;
type DeleteDesktopRecord = Static<typeof DeleteDesktopRecordSchema>;

export const registerProjectRoutes = ({ server, input, route }: RouteRegistrationContext): void => {
  server.get(
    '/api/v1/projects',
    route<void>(() => input.projects.listProjects()),
  );
  server.post(
    '/api/v1/projects',
    { schema: { body: CreateProjectSchema } },
    route<CreateProject>((request) => input.projectService.createProject(request.body), 201),
  );
  server.post(
    '/api/v1/projects/open',
    { schema: { body: OpenProjectSchema } },
    route<OpenProject>((request) => input.projectService.openProject(request.body)),
  );
  server.patch(
    '/api/v1/projects/:projectId',
    { schema: { body: RenameProjectSchema } },
    route<RenameProject>((request) =>
      input.projectService.renameProject(request.params.projectId, request.body.name),
    ),
  );
  server.delete(
    '/api/v1/projects/:projectId',
    { schema: { body: DeleteDesktopRecordSchema } },
    route<DeleteDesktopRecord>((request) => {
      input.projectService.deleteProject(request.params.projectId);
      return { deleted: true as const };
    }),
  );
  server.get(
    '/api/v1/projects/:projectId/pages',
    route<void>((request) => input.projects.listPages(request.params.projectId)),
  );
  server.post(
    '/api/v1/projects/:projectId/pages',
    { schema: { body: CreatePageSchema } },
    route<CreatePage>(
      (request) => input.projectService.createPage(request.params.projectId, request.body),
      201,
    ),
  );
  server.patch(
    '/api/v1/pages/:pageId',
    { schema: { body: RenamePageSchema } },
    route<RenamePage>((request) =>
      input.projectService.renamePage(
        String(request.headers['x-origamix-project-id'] ?? ''),
        request.params.pageId,
        request.body.name,
      ),
    ),
  );
  server.post(
    '/api/v1/pages/:pageId/duplicate',
    { schema: { body: DuplicatePageSchema } },
    route<DuplicatePage>(
      (request) =>
        input.projectService.duplicatePage(
          String(request.headers['x-origamix-project-id'] ?? ''),
          request.params.pageId,
          request.body.name,
        ),
      201,
    ),
  );
  server.delete(
    '/api/v1/pages/:pageId',
    { schema: { body: DeleteDesktopRecordSchema } },
    route<DeleteDesktopRecord>(async (request) => {
      await input.projectService.deletePage(
        String(request.headers['x-origamix-project-id'] ?? ''),
        request.params.pageId,
      );
      return { deleted: true as const };
    }),
  );
};
