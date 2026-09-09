import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import type { Static } from '@sinclair/typebox';
import { nanoid } from 'nanoid';
import {
  CreatePageSchema,
  CreateProjectSchema,
  DeleteDesktopRecordSchema,
  DuplicatePageSchema,
  OpenProjectSchema,
  RenamePageSchema,
  RenameProjectSchema,
  WorkspacePatchSchema,
  type ApiResult,
} from '@origamix/shared/protocol/api';
import type { ChangeSet } from '@origamix/shared/protocol/schema';
import {
  commitSchema,
  getSchema,
  getSchemaRevision,
  undoSchema,
} from '../../services/schema-service';
import type { RuntimeDiagnosticService } from '../../services/runtime-diagnostic-service';
import { RuntimeRenderReportSchema } from '@origamix/shared/protocol/agent';
import type { RuntimeRenderReport } from '@origamix/shared/protocol/agent';
import type { ProjectRepository } from '../../repositories/project-repository';
import type { WorkspaceRepository } from '../../repositories/workspace-repository';
import type { ProjectService } from '../../services/project-service';
import { ApiError, invalid, notFound } from '../../errors';
import {
  CancelAgentRunRequestSchema,
  CreateAgentRunRequestSchema,
  type AgentRun,
  type CreateAgentRunRequest,
} from '@origamix/shared/protocol/agent';
import type { ConversationService } from '../../services/conversation-service';
import type { AgentRunService } from '../../services/agent-run-service';
import type { AgentRunRecord } from '../../repositories/agent-run-repository';
import type { AgentEventBroker } from '../../agent/agent-event-broker';
import type { AgentApplicationService } from '../../services/agent-application-service';

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
type RenameProject = Static<typeof RenameProjectSchema>;
type RenamePage = Static<typeof RenamePageSchema>;
type DuplicatePage = Static<typeof DuplicatePageSchema>;
type DeleteDesktopRecord = Static<typeof DeleteDesktopRecordSchema>;
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
  agent?: {
    conversations: ConversationService;
    runs: AgentRunService;
    events: AgentEventBroker;
    application: AgentApplicationService;
  };
  runtimeDiagnostics?: RuntimeDiagnosticService;
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
        'Authorization, Content-Type, Last-Event-ID, X-Origamix-Service, X-Origamix-Project-Id, X-Origamix-Page-Id, X-Origamix-After-Sequence, X-Request-Id',
      );
      reply.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
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
  server.patch(
    '/api/v1/pages/:pageId',
    { schema: { body: RenamePageSchema } },
    route<RenamePage>((request) => {
      const projectId = String(request.headers['x-origamix-project-id'] ?? '');
      return input.projectService.renamePage(projectId, request.params.pageId, request.body.name);
    }),
  );
  server.post(
    '/api/v1/pages/:pageId/duplicate',
    { schema: { body: DuplicatePageSchema } },
    route<DuplicatePage>((request) => {
      const projectId = String(request.headers['x-origamix-project-id'] ?? '');
      return input.projectService.duplicatePage(
        projectId,
        request.params.pageId,
        request.body.name,
      );
    }, 201),
  );
  server.delete(
    '/api/v1/pages/:pageId',
    { schema: { body: DeleteDesktopRecordSchema } },
    route<DeleteDesktopRecord>((request) => {
      const projectId = String(request.headers['x-origamix-project-id'] ?? '');
      input.projectService.deletePage(projectId, request.params.pageId);
      return { deleted: true as const };
    }),
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
  server.get(
    '/api/v1/pages/:pageId/revisions/:revisionId/schema',
    route<void>(async (request) => {
      const projectId = String(request.headers['x-origamix-project-id'] ?? '');
      const page = input.projects.getPage(projectId, request.params.pageId);
      const project = input.projects.getProject(projectId);
      if (!page || !project) throw notFound('页面不存在');
      return getSchemaRevision(
        { projectPath: project.path, pageId: page.id, slug: page.slug },
        request.params.revisionId,
      );
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
  if (input.runtimeDiagnostics) {
    server.post(
      '/api/v1/pages/:pageId/runtime-reports',
      { schema: { body: RuntimeRenderReportSchema } },
      route<RuntimeRenderReport>(async (request) => {
        const projectId = String(request.headers['x-origamix-project-id'] ?? '');
        if (request.body.projectId !== projectId || request.body.pageId !== request.params.pageId)
          throw invalid('Runtime 报告归属不匹配');
        return input.runtimeDiagnostics!.report(request.body);
      }),
    );
    server.get(
      '/api/v1/pages/:pageId/runtime-state',
      route<void>(async (request) => {
        const projectId = String(request.headers['x-origamix-project-id'] ?? '');
        return input.runtimeDiagnostics!.getState(projectId, request.params.pageId);
      }),
    );
  }
  if (input.agent) {
    const agent = input.agent;
    const requireProjectHeader = (request: RouteInput<unknown>): string => {
      const projectId = String(request.headers['x-origamix-project-id'] ?? '');
      if (!projectId) throw invalid('缺少项目上下文');
      return projectId;
    };
    const publicRun = (run: AgentRunRecord): AgentRun => ({
      version: '1',
      runId: run.id,
      projectId: run.projectId,
      pageId: run.pageId,
      conversationId: run.conversationId,
      userMessageId: run.userMessageId,
      requestId: run.clientRequestId,
      baseRevisionId: run.baseRevisionId,
      mode: run.mode,
      status: run.status,
      budget: run.budget,
      modelRef: run.modelRef,
      promptVersion: run.promptVersion,
      policyVersion: run.policyVersion,
      toolsetVersion: run.toolsetVersion,
      materialManifestVersion: run.materialManifestVersion,
      ...(run.resultRevisionId ? { resultRevisionId: run.resultRevisionId } : {}),
      ...(run.retryOfRunId ? { retryOfRunId: run.retryOfRunId } : {}),
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    });
    const requireOwnedRun = (projectId: string, runId: string) => {
      const run = agent.runs.get(runId);
      if (run.projectId !== projectId) throw notFound('Agent Run 不存在');
      return run;
    };

    server.get(
      '/api/v1/pages/:pageId/conversations',
      route<void>((request) => {
        const projectId = requireProjectHeader(request);
        return {
          version: '1',
          conversations: agent.conversations.list(projectId, request.params.pageId).map((item) => ({
            version: '1',
            conversationId: item.id,
            projectId: item.projectId,
            pageId: item.pageId,
            title: item.title,
            status: item.status === 'archived' ? ('archived' as const) : ('active' as const),
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          })),
        };
      }),
    );
    server.get(
      '/api/v1/conversations/:conversationId/messages',
      route<void>((request) => {
        const projectId = requireProjectHeader(request);
        const pageId = String(request.headers['x-origamix-page-id'] ?? '');
        if (!pageId) throw invalid('缺少页面上下文');
        const after = Number(request.headers['x-origamix-after-sequence'] ?? -1);
        return {
          version: '1',
          messages: agent.conversations
            .history(
              projectId,
              pageId,
              request.params.conversationId,
              Number.isSafeInteger(after) && after >= -1 ? after : -1,
            )
            .map((message) => ({
              version: message.version,
              messageId: message.messageId,
              conversationId: message.conversationId,
              ...(message.runId ? { runId: message.runId } : {}),
              role: message.role,
              content: message.content,
              sequence: message.sequence,
              createdAt: message.createdAt,
            })),
        };
      }),
    );
    server.post(
      '/api/v1/agent/runs',
      { schema: { body: CreateAgentRunRequestSchema } },
      route<CreateAgentRunRequest>(async (request) => {
        const projectId = requireProjectHeader(request);
        if (projectId !== request.body.projectId) throw notFound('项目上下文不匹配');
        const started = await agent.application.start(request.body);
        return {
          version: '1',
          runId: started.run.id,
          conversationId: started.conversationId,
          userMessageId: started.userMessageId,
          status: started.run.status,
        };
      }, 202),
    );
    server.get(
      '/api/v1/agent/runs/:runId',
      route<void>((request) => {
        const projectId = requireProjectHeader(request);
        return { version: '1', run: publicRun(requireOwnedRun(projectId, request.params.runId)) };
      }),
    );
    server.post(
      '/api/v1/agent/runs/:runId/cancel',
      { schema: { body: CancelAgentRunRequestSchema } },
      route<{ version: '1'; requestId: string }>((request) => {
        const projectId = requireProjectHeader(request);
        const run = requireOwnedRun(projectId, request.params.runId);
        const cancelled = agent.application.cancel(run.id, request.body.requestId);
        return {
          version: '1',
          runId: run.id,
          status:
            cancelled.status === 'cancelled' ? ('cancelled' as const) : ('cancelling' as const),
        };
      }),
    );
    server.get('/api/v1/agent/runs/:runId/events', async (request, reply) => {
      const projectId = String(request.headers['x-origamix-project-id'] ?? '');
      requireOwnedRun(projectId, (request.params as { runId: string }).runId);
      const runId = (request.params as { runId: string }).runId;
      const cursorHeader = request.headers['last-event-id'];
      const cursorQuery = (request.query as { afterEventId?: string }).afterEventId;
      const cursor = Number(cursorHeader ?? cursorQuery ?? -1);
      reply.hijack();
      reply.raw.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      });
      const write = (event: import('@origamix/shared/protocol/agent').AgentEvent) => {
        reply.raw.write(
          `id: ${event.eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
        );
        if (
          event.type.startsWith('run.') &&
          ['completed', 'failed', 'cancelled', 'interrupted'].includes(event.type.slice(4))
        ) {
          subscription.close();
          reply.raw.end();
        }
      };
      const subscription = agent.events.subscribe(
        runId,
        Number.isSafeInteger(cursor) ? cursor : -1,
        write,
      );
      for (const event of subscription.replay) write(event);
      if (agent.events.isTerminal(runId) && !reply.raw.writableEnded) reply.raw.end();
      const heartbeat = setInterval(() => reply.raw.write(': heartbeat\n\n'), 15_000);
      heartbeat.unref();
      request.raw.on('close', () => {
        clearInterval(heartbeat);
        subscription.close();
      });
    });
  }
  return server;
}
