import { ApplicationDatabase } from './database/database';
import { ProjectRepository } from './repositories/project-repository';
import { AgentRunRepository } from './repositories/agent-run-repository';
import { ConversationRepository } from './repositories/conversation-repository';
import { WorkspaceRepository } from './repositories/workspace-repository';
import { AgentRunService } from './services/agent-run-service';
import { recoverAgentRunsOnStartup } from './services/agent-run-recovery';
import { ConversationService } from './services/conversation-service';
import { ProjectService } from './services/project-service';
import { getSchema } from './services/schema-service';
import { createHttpServer } from './transport/http/server';
import { AgentEventBroker } from './agent/agent-event-broker';
import { DeterministicMvpDispatcher } from './agent/deterministic-mvp-dispatcher';
import { RuntimeDiagnosticRepository } from './repositories/runtime-diagnostic-repository';
import { RuntimeDiagnosticService } from './services/runtime-diagnostic-service';

export { createMvpPiModels, mvpModelReference } from './agent/pi-runtime';
export * from './agent/agent-engine';
export * from './agent/pi-agent-engine';
export * from './agent/agent-orchestrator';
export * from './agent/agent-event-broker';
export * from './agent/deterministic-mvp-dispatcher';
export * from './agent/evaluation-harness';
export * from './agent/mvp-gate';
export * from './agent/security-audit';
export * from './agent/domain-tools';
export * from './agent/read-only-tools';
export * from './agent/replace-page-schema-tool';
export * from './agent/tool-registry';
export { probeDeepSeekCapabilities } from './agent/model-capability-probe';
export { ContextAssembler } from './agent/context-assembler';
export type {
  AssembleContextInput,
  AssembledAgentContext,
  ContextBudget,
  ContextHistoryProvider,
  ContextSchemaReader,
} from './agent/context-assembler';
export { OUT_OF_SCOPE_REPLY, ScopeRouter } from './agent/scope-router';
export type { ScopeClassifier, ScopeRouterOptions } from './agent/scope-router';
export type {
  DeepSeekCapabilityReport,
  ModelProbeFailureCode,
  ModelProbeObservation,
} from './agent/model-capability-probe';
export { AgentRunRepository } from './repositories/agent-run-repository';
export { ConversationRepository } from './repositories/conversation-repository';
export { RuntimeDiagnosticRepository } from './repositories/runtime-diagnostic-repository';
export { AgentRunService } from './services/agent-run-service';
export { recoverAgentRunsOnStartup } from './services/agent-run-recovery';
export { ConversationService } from './services/conversation-service';
export { DEFAULT_PRODUCT_DOCS, ProductDocsProvider } from './services/product-docs-provider';
export type {
  ProductDocument,
  ProductDocSnippet,
  ProductDocsSearchInput,
} from './services/product-docs-provider';
export {
  RuntimeDiagnosticService,
  redactRuntimeMessage,
} from './services/runtime-diagnostic-service';

export async function startServer(input: {
  databasePath: string;
  templatePath: string;
  desktopToken: string;
  serviceInstanceId: string;
  projectPath?: string;
  allowedOrigins?: readonly string[];
}) {
  const database = new ApplicationDatabase(input.databasePath);
  const projects = new ProjectRepository(database);
  const workspace = new WorkspaceRepository(database);
  const conversations = new ConversationRepository(database);
  const runs = new AgentRunRepository(database);
  const conversationService = new ConversationService(database, projects, conversations, runs);
  const runService = new AgentRunService(runs);
  const agentEvents = new AgentEventBroker();
  const runtimeDiagnostics = new RuntimeDiagnosticService(
    projects,
    new RuntimeDiagnosticRepository(database),
    async (projectId, pageId) => {
      const project = projects.getProject(projectId);
      const page = projects.getPage(projectId, pageId);
      if (!project || !page) throw new Error('页面不存在或不属于当前项目');
      return (await getSchema({ projectPath: project.path, pageId: page.id, slug: page.slug }))
        .revisionId;
    },
  );
  const dispatcher = new DeterministicMvpDispatcher({
    conversations: conversationService,
    runs: runService,
    events: agentEvents,
    projects,
  });
  const projectService = new ProjectService(projects, input.templatePath);
  const server = createHttpServer({
    ...input,
    projects,
    workspace,
    projectService,
    runtimeDiagnostics,
    agent: {
      conversations: conversationService,
      runs: runService,
      events: agentEvents,
      getCurrentRevision: async (projectId, pageId) => {
        const project = projects.getProject(projectId);
        const page = projects.getPage(projectId, pageId);
        if (!project || !page) throw new Error('页面不存在或不属于当前项目');
        return (await getSchema({ projectPath: project.path, pageId: page.id, slug: page.slug }))
          .revisionId;
      },
      dispatch: (dispatchInput) => dispatcher.dispatch(dispatchInput),
    },
  });
  try {
    // Only an explicit host-side startup option grants access to an existing directory.
    if (input.projectPath) {
      projectService.registerGrant('startup-project', input.projectPath);
      await projectService.openProject({ directoryGrantId: 'startup-project' });
    }
    await recoverAgentRunsOnStartup(runs, projects);
    await server.listen({ host: '127.0.0.1', port: 0 });
    const address = server.server.address();
    if (!address || typeof address === 'string') throw new Error('无法取得 HTTP 服务端口');
    return {
      port: address.port,
      conversationService,
      runService,
      registerGrant: (id: string, path: string) => projectService.registerGrant(id, path),
      close: async () => {
        await server.close();
        database.close();
      },
    };
  } catch (error) {
    await server.close();
    database.close();
    throw error;
  }
}
