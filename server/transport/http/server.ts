import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { nanoid } from 'nanoid';
import {
  CreatePageSchema,
  CreateProjectSchema,
  OpenProjectSchema,
  WorkspacePatchSchema,
  type ApiResult
} from '../../../src/shared/protocol/api';
import type { ChangeSet } from '../../../src/shared/protocol/schema';
import { commitSchema, getSchema, undoSchema } from '../../../src/main/services/schema-service';
import type { ProjectRepository } from '../../repositories/project-repository';
import type { WorkspaceRepository } from '../../repositories/workspace-repository';
import type { ProjectService } from '../../services/project-service';

function requestId(value: unknown): string {
  return typeof value === 'string' && value.length <= 100 ? value : nanoid();
}
function failure(requestId: string, error: unknown): ApiResult<never> {
  return {
    ok: false,
    error: {
      code: 'REQUEST_FAILED',
      message: error instanceof Error ? error.message : '请求失败',
      requestId
    }
  };
}

type CreateProject = Static<typeof CreateProjectSchema>;
type OpenProject = Static<typeof OpenProjectSchema>;
type CreatePage = Static<typeof CreatePageSchema>;
type WorkspacePatch = Static<typeof WorkspacePatchSchema>;
type WithoutChangeSetId<T> = T extends unknown ? Omit<T, 'changeSetId'> : never;
type ChangeSetRequest = WithoutChangeSetId<ChangeSet>;
type RouteInput<T> = { body: T; params: Record<string, string>; headers: Record<string, unknown> };

export function createHttpServer(input: {
  desktopToken: string;
  serviceInstanceId: string;
  projects: ProjectRepository;
  workspace: WorkspaceRepository;
  projectService: ProjectService;
}): FastifyInstance {
  const server = Fastify({ bodyLimit: 512 * 1024, logger: false });
  server.addHook('onRequest', async (request, reply) => {
    const id = requestId(request.headers['x-request-id']);
    request.headers['x-request-id'] = id;
    const origin = request.headers.origin;
    const allowedOrigins = new Set(['null', 'http://localhost:5173']);
    if (origin && !allowedOrigins.has(origin)) {
      return reply.code(403).send({
        ok: false,
        error: { code: 'ORIGIN_DENIED', message: '请求来源不受信任', requestId: id }
      });
    }
    if (origin) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Vary', 'Origin');
      reply.header(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type, X-Origamix-Service, X-Origamix-Project-Id, X-Request-Id'
      );
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    }
    if (request.method === 'OPTIONS') return reply.code(204).send();
    const authorization = request.headers.authorization;
    if (
      authorization !== `Bearer ${input.desktopToken}` ||
      request.headers['x-origamix-service'] !== input.serviceInstanceId
    ) {
      return reply.code(401).send({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: '桌面会话无效', requestId: id }
      });
    }
  });
  server.setErrorHandler((error, request, reply) =>
    reply.code(400).send(failure(requestId(request.headers['x-request-id']), error))
  );
  const route =
    <T>(handler: (request: RouteInput<T>) => Promise<unknown> | unknown) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      const id = requestId(request.headers['x-request-id']);
      try {
        reply.send({
          ok: true,
          data: await handler({
            body: request.body as T,
            params: request.params as Record<string, string>,
            headers: request.headers as Record<string, unknown>
          })
        });
      } catch (error) {
        reply.send(failure(id, error));
      }
    };

  server.get('/api/v1/health', async () => ({
    ok: true,
    data: { serviceInstanceId: input.serviceInstanceId }
  }));
  server.get(
    '/api/v1/workspace',
    route<void>(async () => input.workspace.get())
  );
  server.patch(
    '/api/v1/workspace',
    { schema: { body: WorkspacePatchSchema } },
    route<WorkspacePatch>((request) => input.workspace.save(request.body))
  );
  server.get(
    '/api/v1/projects',
    route<void>(async () => input.projects.listProjects())
  );
  server.post(
    '/api/v1/projects',
    { schema: { body: CreateProjectSchema } },
    route<CreateProject>((request) => input.projectService.createProject(request.body))
  );
  server.post(
    '/api/v1/projects/open',
    { schema: { body: OpenProjectSchema } },
    route<OpenProject>((request) => input.projectService.openProject(request.body))
  );
  server.get(
    '/api/v1/projects/:projectId/pages',
    route<void>(async (request) => input.projects.listPages(request.params.projectId))
  );
  server.post(
    '/api/v1/projects/:projectId/pages',
    { schema: { body: CreatePageSchema } },
    route<CreatePage>((request) =>
      input.projectService.createPage(request.params.projectId, request.body)
    )
  );
  server.get(
    '/api/v1/pages/:pageId/schema',
    route<void>(async (request) => {
      const projectId = String(request.headers['x-origamix-project-id'] ?? '');
      const page = input.projects.getPage(projectId, request.params.pageId);
      const project = input.projects.getProject(projectId);
      if (!page || !project) throw new Error('页面不存在');
      return getSchema({ projectPath: project.path, pageId: page.id, slug: page.slug });
    })
  );
  server.post(
    '/api/v1/pages/:pageId/changesets',
    route<ChangeSetRequest>(async (request) => {
      const projectId = String(request.headers['x-origamix-project-id'] ?? '');
      const page = input.projects.getPage(projectId, request.params.pageId);
      const project = input.projects.getProject(projectId);
      const changeSet = { ...request.body, changeSetId: `change_${nanoid()}` } as ChangeSet;
      if (!page || !project || changeSet.pageId !== page.id) throw new Error('页面或变更集无效');
      return commitSchema(
        { projectPath: project.path, pageId: page.id, slug: page.slug },
        changeSet
      );
    })
  );
  server.post(
    '/api/v1/pages/:pageId/undo',
    route<void>(async (request) => {
      const projectId = String(request.headers['x-origamix-project-id'] ?? '');
      const page = input.projects.getPage(projectId, request.params.pageId);
      const project = input.projects.getProject(projectId);
      if (!page || !project) throw new Error('页面不存在');
      return undoSchema({ projectPath: project.path, pageId: page.id, slug: page.slug });
    })
  );
  return server;
}
