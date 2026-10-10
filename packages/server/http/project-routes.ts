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
import {
  EmptyBodySchema,
  ProjectScopeSchema,
  withPageScope,
  withProjectScope,
} from './body-schemas';
import type { RouteRegistrationContext } from './types';

const RenameProjectBodySchema = withProjectScope(RenameProjectSchema);
const DeleteProjectBodySchema = withProjectScope(DeleteDesktopRecordSchema);
const CreatePageBodySchema = withProjectScope(CreatePageSchema);
const RenamePageBodySchema = withPageScope(RenamePageSchema);
const DuplicatePageBodySchema = withPageScope(DuplicatePageSchema);
const DeletePageBodySchema = withPageScope(DeleteDesktopRecordSchema);

export const registerProjectRoutes = ({ server, input, route }: RouteRegistrationContext): void => {
  server.post(
    '/api/v1/projects/list',
    { schema: { body: EmptyBodySchema } },
    route(() => input.projects.listProjects()),
  );
  server.post(
    '/api/v1/projects/create',
    { schema: { body: CreateProjectSchema } },
    route<Static<typeof CreateProjectSchema>>(
      (request) => input.projectService.createProject(request.body),
      201,
    ),
  );
  server.post(
    '/api/v1/projects/open',
    { schema: { body: OpenProjectSchema } },
    route<Static<typeof OpenProjectSchema>>((request) =>
      input.projectService.openProject(request.body),
    ),
  );
  server.post(
    '/api/v1/projects/rename',
    { schema: { body: RenameProjectBodySchema } },
    route<Static<typeof RenameProjectBodySchema>>((request) =>
      input.projectService.renameProject(request.body.projectId, request.body.name),
    ),
  );
  server.post(
    '/api/v1/projects/delete',
    { schema: { body: DeleteProjectBodySchema } },
    route<Static<typeof DeleteProjectBodySchema>>((request) => {
      input.projectService.deleteProject(request.body.projectId);
      return { deleted: true as const };
    }),
  );
  server.post(
    '/api/v1/pages/list',
    { schema: { body: ProjectScopeSchema } },
    route<Static<typeof ProjectScopeSchema>>((request) =>
      input.projects.listPages(request.body.projectId),
    ),
  );
  server.post(
    '/api/v1/pages/create',
    { schema: { body: CreatePageBodySchema } },
    route<Static<typeof CreatePageBodySchema>>((request) => {
      const { projectId, ...body } = request.body;
      return input.projectService.createPage(projectId, body);
    }, 201),
  );
  server.post(
    '/api/v1/pages/rename',
    { schema: { body: RenamePageBodySchema } },
    route<Static<typeof RenamePageBodySchema>>((request) =>
      input.projectService.renamePage(
        request.body.projectId,
        request.body.pageId,
        request.body.name,
      ),
    ),
  );
  server.post(
    '/api/v1/pages/duplicate',
    { schema: { body: DuplicatePageBodySchema } },
    route<Static<typeof DuplicatePageBodySchema>>(
      (request) =>
        input.projectService.duplicatePage(
          request.body.projectId,
          request.body.pageId,
          request.body.name,
        ),
      201,
    ),
  );
  server.post(
    '/api/v1/pages/delete',
    { schema: { body: DeletePageBodySchema } },
    route<Static<typeof DeletePageBodySchema>>(async (request) => {
      await input.projectService.deletePage(request.body.projectId, request.body.pageId);
      return { deleted: true as const };
    }),
  );
};
