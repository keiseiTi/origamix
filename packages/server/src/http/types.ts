import type { DiagnosticLogger } from '../logging/logger';
import type { ProjectExportSnapshot } from '@origamix/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ProjectRepository } from '../projects/project-repository';
import type { ProjectService } from '../projects/project-service';
import type { ProjectApplyService } from '../schema/project-apply-service';
import type { RuntimeDiagnosticService } from '../diagnostics/diagnostic-service';
import type { AgentConversations } from '../agent/persistence';
import type { AgentRunService } from '../agent/run-service';
import type { AgentEventBroker } from '../agent/event-broker';
import type { AgentService } from '../agent/agent-service';

export interface TemplateDownload {
  version: string;
  body: Buffer;
  sha256: string;
}

type Awaitable<T> = T | Promise<T>;
type ProjectQueries = Pick<ProjectRepository, 'getProject' | 'getPage'>;
type TreeQueries = {
  [K in 'listProjects' | 'listPages']: (
    ...args: Parameters<ProjectRepository[K]>
  ) => Awaitable<
    K extends 'listProjects'
      ? (Omit<ReturnType<ProjectRepository[K]>[number], 'path'> & { path?: string })[]
      : ReturnType<ProjectRepository[K]>
  >;
};
type ProjectCommands = Pick<
  ProjectService,
  | 'getSettings'
  | 'updateSettings'
  | 'getNavigation'
  | 'getPageRoles'
  | 'updatePageRoles'
  | 'getStack'
  | 'deleteProject'
  | 'createPage'
  | 'renamePage'
  | 'duplicatePage'
  | 'deletePage'
> & {
  renameProject: (
    projectId: string,
    name: string,
  ) => Promise<Omit<import('@origamix/shared').ProjectRecord, 'path'>>;
};

interface HttpServerServices {
  logger?: DiagnosticLogger;
  desktopToken: string;
  serviceInstanceId: string;
  projects: TreeQueries & Partial<ProjectQueries>;
  projectService: ProjectCommands & Partial<Pick<ProjectService, 'createProject' | 'openProject'>>;
  resolveSchemaPage?: (
    projectId: string,
    pageId: string,
  ) => import('../schema/schema-contracts').SchemaPageRef;
  allowedOrigins?: readonly string[];
  templateDownload?: TemplateDownload;
  agent?: {
    conversations: Pick<AgentConversations, 'list' | 'history' | 'recentHistory'>;
    runs: Pick<AgentRunService, 'get'>;
    events: AgentEventBroker;
    service: Pick<AgentService, 'start' | 'cancel' | 'pageActivity'>;
  };
  agentUsage?: import('../agent/agent-usage-service').AgentUsageService;
  runtimeDiagnostics?: RuntimeDiagnosticService;
}

export type HttpServerInput = HttpServerServices &
  (
    | { host: 'desktop'; projectApplyService?: ProjectApplyService }
    | {
        host: 'web';
        createDatabaseProject: import('../projects/mysql-project-service').MysqlProjectService['createDatabaseProject'];
        exportProject?: (projectId: string) => Promise<ProjectExportSnapshot>;
      }
  );

export type RouteInput<T> = {
  body: T;
  requestId: string;
};

export type RouteAdapter = <T>(
  handler: (request: RouteInput<T>) => Promise<unknown> | unknown,
  successStatus?: number,
) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export interface RouteRegistrationContext {
  server: FastifyInstance;
  input: HttpServerInput;
  route: RouteAdapter;
}
