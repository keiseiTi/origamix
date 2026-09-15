import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ProjectRepository } from '../../../repositories/project-repository';
import type { ProjectService } from '../../../services/project-service';
import type { ProjectApplyService } from '../../../services/project-apply-service';
import type { RuntimeDiagnosticService } from '../../../services/runtime-diagnostic-service';
import type { ConversationService } from '../../../services/conversation-service';
import type { AgentRunService } from '../../../services/agent-run-service';
import type { AgentEventBroker } from '../../../agent/agent-event-broker';
import type { AgentApplicationService } from '../../../services/agent-application-service';

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
    application: AgentApplicationService;
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
