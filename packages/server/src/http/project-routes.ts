import { Type, type Static } from '@sinclair/typebox';
import {
  ProjectSettingsUpdateSchema,
  UpdatePageRolesSchema,
  CreatePageSchema,
  CreateProjectSchema,
  DuplicatePageSchema,
  OpenProjectSchema,
  RenamePageSchema,
  RenameProjectSchema,
} from '@origamix/shared';
import {
  EmptyBodySchema,
  PageScopeSchema,
  ProjectScopeSchema,
  withPageScope,
  withProjectScope,
} from './body-schemas';
import type { RouteRegistrationContext } from './types';

const CreateDatabaseProjectSchema = Type.Omit(CreateProjectSchema, ['directoryGrantId'], {
  additionalProperties: false,
});

const RenameProjectBodySchema = withProjectScope(RenameProjectSchema);
const CreatePageBodySchema = withProjectScope(CreatePageSchema);
const RenamePageBodySchema = withPageScope(RenamePageSchema);
const DuplicatePageBodySchema = withPageScope(DuplicatePageSchema);

export const registerProjectRoutes = ({ server, input, route }: RouteRegistrationContext): void => {
  server.post(
    '/api/v1/projects/settings/get',
    { schema: { body: ProjectScopeSchema } },
    route<Static<typeof ProjectScopeSchema>>(({ body }) =>
      input.projectService.getSettings(body.projectId),
    ),
  );
  server.post(
    '/api/v1/projects/settings/update',
    { schema: { body: ProjectSettingsUpdateSchema } },
    route<Static<typeof ProjectSettingsUpdateSchema>>(({ body }) =>
      input.projectService.updateSettings(body),
    ),
  );
  server.post(
    '/api/v1/projects/navigation/get',
    { schema: { body: ProjectScopeSchema } },
    route<Static<typeof ProjectScopeSchema>>(({ body }) =>
      input.projectService.getNavigation(body.projectId),
    ),
  );
  server.post(
    '/api/v1/projects/page-roles/get',
    { schema: { body: ProjectScopeSchema } },
    route<Static<typeof ProjectScopeSchema>>((request) =>
      input.projectService.getPageRoles(request.body.projectId),
    ),
  );
  server.post(
    '/api/v1/projects/page-roles/update',
    { schema: { body: UpdatePageRolesSchema } },
    route<Static<typeof UpdatePageRolesSchema>>((request) =>
      input.projectService.updatePageRoles(request.body),
    ),
  );
  server.post(
    '/api/v1/projects/list',
    { schema: { body: EmptyBodySchema } },
    route(() => input.projects.listProjects()),
  );
  server.post(
    '/api/v1/projects/stack/get',
    { schema: { body: ProjectScopeSchema } },
    route<Static<typeof ProjectScopeSchema>>((request) =>
      input.projectService.getStack(request.body.projectId),
    ),
  );
  if (input.host === 'web') {
    const createDatabaseProject = input.createDatabaseProject;
    server.post(
      '/api/v1/projects/create',
      { schema: { body: CreateDatabaseProjectSchema } },
      route<Static<typeof CreateDatabaseProjectSchema>>(
        ({ body }) => createDatabaseProject(body),
        201,
      ),
    );
  } else {
    const { projectService } = input;
    if (projectService.createProject && projectService.openProject) {
      server.post(
        '/api/v1/projects/create',
        { schema: { body: CreateProjectSchema } },
        route<Static<typeof CreateProjectSchema>>(
          ({ body }) => projectService.createProject!(body),
          201,
        ),
      );
      server.post(
        '/api/v1/projects/open',
        { schema: { body: OpenProjectSchema } },
        route<Static<typeof OpenProjectSchema>>(({ body }) => projectService.openProject!(body)),
      );
    }
  }
  server.post(
    '/api/v1/projects/rename',
    { schema: { body: RenameProjectBodySchema } },
    route<Static<typeof RenameProjectBodySchema>>((request) =>
      input.projectService.renameProject(request.body.projectId, request.body.name),
    ),
  );
  server.post(
    '/api/v1/projects/delete',
    { schema: { body: ProjectScopeSchema } },
    route<Static<typeof ProjectScopeSchema>>(async (request) => {
      await input.projectService.deleteProject(request.body.projectId);
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
    { schema: { body: PageScopeSchema } },
    route<Static<typeof PageScopeSchema>>(async (request) => {
      await input.projectService.deletePage(request.body.projectId, request.body.pageId);
      return { deleted: true as const };
    }),
  );
};
