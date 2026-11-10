import { ProjectPreviewService } from './preview/project-preview-service';
import { ProjectTaskService } from './agent/project-task-service';
import { agentTarget } from './agent/agent-target';
import { LayoutService } from './layout/layout-service';
import { loadProjectMaterials, loadLayoutMaterials } from './projects/project-materials';
import { ApplicationDatabase } from './database/database';
import { ProjectRepository } from './projects/project-repository';
import { AgentRunRepository } from './agent/run-repository';
import { ConversationRepository } from './conversations/conversation-repository';
import { AgentRunService } from './agent/run-service';
import { recoverAgentRunsOnStartup } from './agent/run-recovery';
import { ConversationService } from './conversations/conversation-service';
import { ProjectService } from './projects/project-service';
import { ProjectApplyService } from './schema/project-apply-service';
import { getWorkingSchemaState } from './schema/schema-service';
import { createHttpServer } from './http/server';
import { AgentEventBroker } from './agent/event-broker';
import { RuntimeDiagnosticCache } from './diagnostics/diagnostic-cache';
import { RuntimeDiagnosticService } from './diagnostics/diagnostic-service';
import { AgentService } from './agent/agent-service';
import { RunExecutor } from './agent/run-executor';
import { ContextAssembler } from './agent/context-assembler';
import { ProductDocsProvider } from './agent/product-docs-provider';
import { createReadOnlyAgentTools } from './agent/tools/read-only-tools';
import { createDomainAgentTools } from './agent/tools/domain-tools';
import { createCompletePageRunTool } from './agent/tools/complete-page-run';
import { createDefaultAgentToolEntries } from './agent/tools/registry';
import { DEEPSEEK_FLASH_MODEL_ID } from './agent/agent-engine';
import { PiAgentEngine } from './agent/pi-agent-engine';
import { createPiModels } from './agent/pi-runtime';
import { progressPayload } from './agent/progress';
import { AgentToolAuditRepository } from './agent/tool-audit-repository';

export const startServer = async (input: {
  port?: number;
  databasePath: string;
  templatePath: string;
  previewAssetDirectory?: string;
  desktopToken: string;
  serviceInstanceId: string;
  projectPath?: string;
  allowedOrigins?: readonly string[];
  getModelCredential?: (provider: 'deepseek') => Promise<string | undefined>;
  getModelReference?: () => Promise<string | undefined>;
}) => {
  const port = input.port ?? 1029;
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('后端端口必须为 0 到 65535 的整数');
  const database = new ApplicationDatabase(input.databasePath);
  let dispose: (() => Promise<void>) | undefined;
  try {
    const projects = new ProjectRepository(database);
    const conversations = new ConversationRepository(database);
    const runs = new AgentRunRepository(database);
    const toolAudits = new AgentToolAuditRepository(database);
    const conversationService = new ConversationService(database, projects, conversations, runs);
    const runService = new AgentRunService(runs);
    const agentEvents = new AgentEventBroker();
    runService.setTransitionListener((run) => {
      const payload = progressPayload(run.status, run.pageId ? 'page' : 'layout');
      if (!payload) return;
      agentEvents.publish({
        type: 'run.progress',
        runId: run.id,
        pageId: run.pageId,
        target: agentTarget(run.projectId, run.pageId),
        requestId: run.clientRequestId,
        payload,
      });
    });
    const getCurrentRevision = async (projectId: string, pageId: string) => {
      const project = projects.getProject(projectId);
      const page = projects.getPage(projectId, pageId);
      if (!project || !page) throw new Error('页面不存在或不属于当前项目');
      return getWorkingSchemaState({
        projectPath: project.path,
        pageId: page.id,
        slug: page.slug,
        relativePath: page.relativePath,
      });
    };
    const runtimeDiagnostics = new RuntimeDiagnosticService(
      projects,
      new RuntimeDiagnosticCache(),
      getCurrentRevision,
    );
    const projectApplyService = new ProjectApplyService(projects);
    const projectService = new ProjectService(
      projects,
      input.templatePath,
      projectApplyService,
      (projectId, pageId) => runtimeDiagnostics.clear(projectId, pageId),
    );
    const layoutService = new LayoutService(projects);
    const readLayout = async (projectId: string) => {
      const value = await layoutService.getWorking(projectId);
      return { ...value, schema: value.document.schema };
    };
    const productDocs = new ProductDocsProvider();
    const context = new ContextAssembler(
      { getCurrent: getWorkingSchemaState },
      conversations,
      productDocs,
      {},
      readLayout,
      projectService.getPageRoles,
    );
    const pi = createPiModels();
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
            {
              projects,
              loadMaterials: scope.pageId ? loadProjectMaterials : loadLayoutMaterials,
              readLayout,
              getProjectRoles: projectService.getPageRoles,
            },
          ),
          ...createDomainAgentTools(
            { projectId: scope.projectId, pageId: scope.pageId },
            {
              projects,
              docs: productDocs,
              diagnostics: runtimeDiagnostics,
              validateLayout: layoutService.validateSchema,
            },
          ),
          createCompletePageRunTool(
            {
              projects,
              runs,
              runService,
              layouts: layoutService,
              prepareProject: (...args) => projectTasks.prepare(...args),
              loadMaterials: scope.pageId ? loadProjectMaterials : loadLayoutMaterials,
            },
            scope,
          ),
        ]),
      audit: (event) => {
        toolAudits.append(event);
        const run = runs.get(event.runId);
        if (!run) return;
        agentEvents.publish({
          type: 'tool.activity',
          runId: run.id,
          pageId: run.pageId,
          target: agentTarget(run.projectId, run.pageId),
          requestId: run.clientRequestId,
          payload: {
            toolName: event.toolName,
            phase: event.phase,
            ...(event.safeErrorCode ? { safeErrorCode: event.safeErrorCode } : {}),
          },
        });
      },
    });
    const agentService = new AgentService({
      authorizeStart: (request) => projectTasks.assertContinuation(request),
      conversations: conversationService,
      projects,
      runs,
      runService,
      events: agentEvents,
      executor,
      getModelRef: async () => (await input.getModelReference?.()) ?? DEEPSEEK_FLASH_MODEL_ID,
      getCurrentState: async (projectId, pageId) => {
        if (!pageId) return readLayout(projectId);
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
    const projectTasks: ProjectTaskService = new ProjectTaskService({
      projects,
      projectService,
      runs,
      getWorkingVersion: async (projectId, pageId) =>
        (await getCurrentRevision(projectId, pageId)).workingVersion,
      startPage: (request) => agentService.start(request),
    });
    const projectPreview = new ProjectPreviewService(projects, input.previewAssetDirectory);
    projectService.setPreviewCloser(projectPreview.endProject);
    const server = createHttpServer({
      projectPreview,
      ...input,
      projects,
      projectService,
      projectApplyService,
      layoutService,
      projectTasks,
      runtimeDiagnostics,
      agent: {
        conversations: conversationService,
        runs: runService,
        events: agentEvents,
        service: agentService,
      },
    });
    let closing = false;
    let closePromise: Promise<void> | undefined;
    server.addHook('onRequest', async (_request, reply) => {
      if (closing)
        return reply.code(503).send({
          success: false,
          code: 503,
          data: null,
          message: '服务正在关闭，请稍后重试',
        });
    });
    const close = (): Promise<void> => {
      if (closePromise) return closePromise;
      closing = true;
      // Fence starts synchronously, before waiting for HTTP/SSE connections to close.
      const agents = agentService.shutdown();
      closePromise = (async () => {
        const http = server.close();
        await projectPreview.close();
        void http.catch(() => undefined);
        // Do not close SQLite underneath an Agent or an HTTP mutation still in flight.
        await agents;
        let timer: ReturnType<typeof setTimeout>;
        try {
          await Promise.race([
            http,
            new Promise<never>((_resolve, reject) => {
              timer = setTimeout(
                () => reject(new Error('HTTP 关闭超时，数据库仍保留，请重试关闭')),
                5_000,
              );
            }),
          ]);
        } finally {
          clearTimeout(timer!);
        }
        database.close();
      })().catch((error: unknown) => {
        closePromise = undefined;
        throw error;
      });
      return closePromise;
    };
    dispose = close;
    // Only an explicit host-side startup option grants access to an existing directory.
    if (input.projectPath) {
      projectService.registerGrant('startup-project', input.projectPath);
      await projectService.openProject({ directoryGrantId: 'startup-project' });
    }
    await recoverAgentRunsOnStartup(runs, projects, conversationService, layoutService);
    await server.listen({ host: '127.0.0.1', port });
    const address = server.server.address();
    if (!address || typeof address === 'string') throw new Error('无法取得 HTTP 服务端口');
    return {
      port: address.port,
      registerGrant: (id: string, path: string) => projectService.registerGrant(id, path),
      close,
    };
  } catch (error) {
    if (dispose) await dispose();
    else database.close();
    throw error;
  }
};
