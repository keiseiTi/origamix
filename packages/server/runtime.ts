import { ApplicationDatabase } from './database/database';
import { ProjectRepository } from './projects/project-repository';
import { AgentRunRepository } from './agent/run-repository';
import { ConversationRepository } from './conversations/conversation-repository';
import { AgentRunService } from './agent/run-service';
import { recoverAgentRunsOnStartup } from './agent/run-recovery';
import { ConversationService } from './conversations/conversation-service';
import { ProjectService } from './projects/project-service';
import { ProjectApplyService } from './schema/project-apply-service';
import { getSchema, getWorkingSchemaState } from './schema/schema-service';
import { createHttpServer } from './http/server';
import { AgentEventBroker } from './agent/event-broker';
import { RuntimeDiagnosticCache } from './diagnostics/diagnostic-cache';
import { RuntimeDiagnosticService } from './diagnostics/diagnostic-service';
import { AgentService } from './agent/agent-service';
import { RunExecutor } from './agent/run-executor';
import { ScopeRouter } from './agent/scope-router';
import { ContextAssembler } from './agent/context-assembler';
import { ProductDocsProvider } from './agent/product-docs-provider';
import { createReadOnlyAgentTools } from './agent/tools/read-only-tools';
import { createDomainAgentTools } from './agent/tools/domain-tools';
import { createApplyPageOperationsTool } from './agent/tools/apply-page-operations';
import { createDefaultAgentToolEntries } from './agent/tools/registry';
import { MVP_MODEL_ID } from './agent/engine';
import { PiAgentEngine } from './agent/pi-agent-engine';
import { createMvpPiModels } from './agent/pi-runtime';

export const startServer = async (input: {
  databasePath: string;
  templatePath: string;
  desktopToken: string;
  serviceInstanceId: string;
  projectPath?: string;
  allowedOrigins?: readonly string[];
  getModelCredential?: (provider: 'deepseek') => Promise<string | undefined>;
  getModelReference?: () => Promise<string | undefined>;
}) => {
  const database = new ApplicationDatabase(input.databasePath);
  const projects = new ProjectRepository(database);
  const conversations = new ConversationRepository(database);
  const runs = new AgentRunRepository(database);
  const conversationService = new ConversationService(database, projects, conversations, runs);
  const runService = new AgentRunService(runs);
  const agentEvents = new AgentEventBroker();
  const getCurrentRevision = async (projectId: string, pageId: string): Promise<string> => {
    const project = projects.getProject(projectId);
    const page = projects.getPage(projectId, pageId);
    if (!project || !page) throw new Error('页面不存在或不属于当前项目');
    return (
      await getSchema({
        projectPath: project.path,
        pageId: page.id,
        slug: page.slug,
        relativePath: page.relativePath,
      })
    ).revisionId;
  };
  const runtimeDiagnostics = new RuntimeDiagnosticService(
    projects,
    new RuntimeDiagnosticCache(),
    getCurrentRevision,
  );
  const projectApplyService = new ProjectApplyService(projects);
  const projectService = new ProjectService(projects, input.templatePath, projectApplyService);
  const productDocs = new ProductDocsProvider();
  const context = new ContextAssembler(
    { getCurrent: getWorkingSchemaState },
    conversations,
    productDocs,
  );
  const pi = createMvpPiModels();
  const executor = new RunExecutor({
    projects,
    runs,
    conversations: conversationService,
    runService,
    context,
    engine: new PiAgentEngine({
      resolveModel: (provider, model) => pi.models.getModel(provider, model),
      stream: pi.models.streamSimple.bind(pi.models),
      getCredential: async (provider) => {
        if (provider !== 'deepseek') return undefined;
        return input.getModelCredential?.('deepseek');
      },
    }),
    createTools: (scope) =>
      createDefaultAgentToolEntries([
        ...createReadOnlyAgentTools(
          {
            runId: scope.runId,
            projectId: scope.projectId,
            pageId: scope.pageId,
            workingVersion: scope.baseWorkingVersion,
          },
          { projects },
        ),
        ...createDomainAgentTools(
          { projectId: scope.projectId, pageId: scope.pageId },
          { projects, docs: productDocs, diagnostics: runtimeDiagnostics },
        ),
        createApplyPageOperationsTool({ projects, runs }, { ...scope, maxSchemaBytes: 256 * 1024 }),
      ]),
  });
  const agentService = new AgentService({
    conversations: conversationService,
    runs,
    runService,
    events: agentEvents,
    executor,
    router: new ScopeRouter(),
    getModelRef: async () => (await input.getModelReference?.()) ?? MVP_MODEL_ID,
    getCurrentState: async (projectId, pageId) => {
      const project = projects.getProject(projectId);
      const page = projects.getPage(projectId, pageId);
      if (!project || !page) throw new Error('页面不存在或不属于当前项目');
      return getWorkingSchemaState({
        projectPath: project.path,
        pageId: page.id,
        slug: page.slug,
        relativePath: page.relativePath,
      });
    },
  });
  const server = createHttpServer({
    ...input,
    projects,
    projectService,
    projectApplyService,
    runtimeDiagnostics,
    agent: {
      conversations: conversationService,
      runs: runService,
      events: agentEvents,
      service: agentService,
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
};
