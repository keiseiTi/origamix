import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { nanoid } from 'nanoid';
import {
  CreatePageSchema,
  CreateProjectSchema,
  OpenProjectSchema,
  WorkspacePatchSchema,
  type ApiResult,
} from '@origamix/shared/protocol/api';
import type { ChangeSet } from '@origamix/shared/protocol/schema';
import { commitSchema, getSchema, undoSchema } from '../../services/schema-service';
import type { ProjectRepository } from '../../repositories/project-repository';
import type { WorkspaceRepository } from '../../repositories/workspace-repository';
import type { ProjectService } from '../../services/project-service';
import { ApiError, invalid, notFound } from '../../errors';

function requestId(value: unknown): string {
  return typeof value === 'string' && value.length <= 100 ? value : nanoid();
}
function errorStatus(error: unknown): number {
  if (error instanceof ApiError) return error.statusCode;
  const statusCode =
    typeof error === 'object' && error !== null && 'statusCode' in error
      ? error.statusCode
      : undefined;
  return typeof statusCode === 'number' && statusCode >= 400 ? statusCode : 500;
}
function failure(error: unknown, fallbackStatus = 500): ApiResult<never> {
  const statusCode = error instanceof ApiError ? error.statusCode : fallbackStatus;
  return {
    success: false,
    code: error instanceof ApiError ? error.code : statusCode,
    data: null,
    message:
      error instanceof ApiError
        ? error.message
        : statusCode < 500 && error instanceof Error
          ? error.message
          : '服务器内部错误',
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
  allowedOrigins?: readonly string[];
}): FastifyInstance {
  const server = Fastify({ bodyLimit: 512 * 1024, logger: false });
  const allowedOrigins = new Set(
    input.allowedOrigins ?? ['null', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  );
  server.addHook('onRequest', async (request, reply) => {
    const id = requestId(request.headers['x-request-id']);
    request.headers['x-request-id'] = id;
    reply.header('X-Request-Id', id);
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      return reply.code(403).send({
        success: false,
        code: 403,
        data: null,
        message: '请求来源不受信任',
      });
    }
    if (origin) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Vary', 'Origin');
      reply.header(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type, X-Origamix-Service, X-Origamix-Project-Id, X-Request-Id',
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
        success: false,
        code: 401,
        data: null,
        message: '桌面会话无效',
      });
    }
  });
  server.setErrorHandler((error, _request, reply) => {
    const statusCode = errorStatus(error);
    return reply.code(statusCode).send(failure(error, statusCode));
  });
  const route =
    <T>(handler: (request: RouteInput<T>) => Promise<unknown> | unknown, successStatus = 200) =>
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        reply.code(successStatus).send({
          success: true,
          code: 200,
          data: await handler({
            body: request.body as T,
            params: request.params as Record<string, string>,
            headers: request.headers as Record<string, unknown>,
          }),
        });
      } catch (error) {
        const statusCode = errorStatus(error);
        reply.code(statusCode).send(failure(error));
      }
    };

  server.get('/api/v1/health', async () => ({
    success: true,
    code: 200,
    data: { serviceInstanceId: input.serviceInstanceId },
  }));
  server.get(
    '/api/v1/workspace',
    route<void>(async () => input.workspace.get()),
  );
  server.patch(
    '/api/v1/workspace',
    { schema: { body: WorkspacePatchSchema } },
    route<WorkspacePatch>((request) => input.workspace.save(request.body)),
  );
  server.get(
    '/api/v1/projects',
    route<void>(async () => input.projects.listProjects()),
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
  server.get(
    '/api/v1/projects/:projectId/pages',
    route<void>(async (request) => input.projects.listPages(request.params.projectId)),
  );
  server.post(
    '/api/v1/projects/:projectId/pages',
    { schema: { body: CreatePageSchema } },
    route<CreatePage>(
      (request) => input.projectService.createPage(request.params.projectId, request.body),
      201,
    ),
  );
  server.get(
    '/api/v1/pages/:pageId/schema',
    route<void>(async (request) => {
      const projectId = String(request.headers['x-origamix-project-id'] ?? '');
      const page = input.projects.getPage(projectId, request.params.pageId);
      const project = input.projects.getProject(projectId);
      if (!page || !project) throw notFound('页面不存在');
      return getSchema({ projectPath: project.path, pageId: page.id, slug: page.slug });
    }),
  );
  server.post(
    '/api/v1/pages/:pageId/changesets',
    route<ChangeSetRequest>(async (request) => {
      const projectId = String(request.headers['x-origamix-project-id'] ?? '');
      const page = input.projects.getPage(projectId, request.params.pageId);
      const project = input.projects.getProject(projectId);
      const changeSet = { ...request.body, changeSetId: `change_${nanoid()}` } as ChangeSet;
      if (!page || !project) throw notFound('页面不存在');
      if (changeSet.pageId !== page.id) throw invalid('变更集与页面不匹配');
      return commitSchema(
        { projectPath: project.path, pageId: page.id, slug: page.slug },
        changeSet,
      );
    }),
  );
  server.post(
    '/api/v1/pages/:pageId/undo',
    route<void>(async (request) => {
      const projectId = String(request.headers['x-origamix-project-id'] ?? '');
      const page = input.projects.getPage(projectId, request.params.pageId);
      const project = input.projects.getProject(projectId);
      if (!page || !project) throw notFound('页面不存在');
      return undoSchema({ projectPath: project.path, pageId: page.id, slug: page.slug });
    }),
  );
  return server;
}
