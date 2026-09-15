import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ProjectRepository } from '../projects/project-repository';
import type { ProjectService } from '../projects/project-service';
import type { ProjectApplyService } from '../schema/project-apply-service';
import type { RuntimeDiagnosticService } from '../diagnostics/diagnostic-service';
import type { ConversationService } from '../conversations/conversation-service';
import type { AgentRunService } from '../agent/run-service';
import type { AgentEventBroker } from '../agent/event-broker';
import type { AgentService } from '../agent/agent-service';

export interface HttpServerInput {
  desktopToken: string;
  serviceInstanceId: string;
  projects: ProjectRepository;
  projectService: ProjectService;
  projectApplyService?: ProjectApplyService;
  allowedOrigins?: readonly string[];
  agent?: {
    conversations: ConversationService;
    runs: AgentRunService;
    events: AgentEventBroker;
    service: AgentService;
  };
  runtimeDiagnostics?: RuntimeDiagnosticService;
}

export type RouteInput<T> = {
  body: T;
  params: Record<string, string>;
  headers: Record<string, unknown>;
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
