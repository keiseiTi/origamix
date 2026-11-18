import type { RowDataPacket } from 'mysql2/promise';
import { AgentService } from '../agent/agent-service';
import { agentTarget } from '../agent/agent-target';
import { ContextAssembler } from '../agent/context-assembler';
import { AgentEventBroker } from '../agent/event-broker';
import { MysqlAgentRunRepository } from '../agent/mysql-agent-repository';
import { PiAgentEngine } from '../agent/pi-agent-engine';
import { createPiModels } from '../agent/pi-runtime';
import { ProductDocsProvider } from '../agent/product-docs-provider';
import { progressPayload } from '../agent/progress';
import { resolveAgentRunBudget } from '../agent/run-budget';
import { RunExecutor } from '../agent/run-executor';
import { recoverAgentRunsOnStartup } from '../agent/run-recovery';
import { AgentRunService } from '../agent/run-service';
import { createCompletePageRunTool } from '../agent/tools/complete-page-run';
import { createDomainAgentTools } from '../agent/tools/domain-tools';
import { createAgentElementIds } from '../agent/tools/element-ids';
import { createReadOnlyAgentTools } from '../agent/tools/read-only-tools';
import { createDefaultAgentToolEntries } from '../agent/tools/registry';
import { createValidatePageOperationsTool } from '../agent/tools/validate-page-operations';
import type { AgentEngine } from '../agent/agent-engine';
import { MysqlConversationService } from '../conversations/mysql-conversation-service';
import { openWebDatabase } from '../database/mysql-web';
import { RuntimeDiagnosticCache } from '../diagnostics/diagnostic-cache';
import { RuntimeDiagnosticService } from '../diagnostics/diagnostic-service';
import { createHttpServer } from '../http/server';
import type { TemplateDownload } from '../http/types';
import { MysqlProjectService } from '../projects/mysql-project-service';
import { getManifestMaterials } from '../projects/project-materials';
import { getWorkingSchemaState } from '../schema/schema-service';

export const startMysqlWebServer = async (input: {
  mysqlUrl: string;
  desktopToken: string;
  serviceInstanceId: string;
  templateDownload?: TemplateDownload;
  getModelCredential?: (provider: 'deepseek') => Promise<string | undefined>;
  agentEngine?: AgentEngine;
}) => {
  const pool = await openWebDatabase(input.mysqlUrl);
  let owner: Awaited<ReturnType<typeof pool.getConnection>> | undefined;
  let server: ReturnType<typeof createHttpServer> | undefined;
  try {
    owner = await pool.getConnection();
    const [lock] = await owner.query<(RowDataPacket & { acquired: number | null })[]>(
      "SELECT GET_LOCK(SHA2(CONCAT('origamix-agent:', DATABASE()), 256), 0) AS acquired",
    );
    if (lock[0]?.acquired !== 1) throw new Error('已有 Web 宿主正在使用这个 MySQL 数据库');
    const projects = new MysqlProjectService(pool);
    const { agentProjects } = projects;
    const resolvePage = (projectId: string, pageId: string) => ({
      ...projects.resolveSchemaPage(projectId, pageId),
      projectPath: projectId,
    });
    const getWorking = (projectId: string, pageId: string) =>
      getWorkingSchemaState(resolvePage(projectId, pageId));
    const loadMaterials = async (projectId: string) =>
      getManifestMaterials(await projects.readManifest(projectId));
    const diagnostics = new RuntimeDiagnosticService(
      undefined,
      new RuntimeDiagnosticCache(),
      getWorking,
    );
    const runs = new MysqlAgentRunRepository(pool);
    const conversations = new MysqlConversationService(pool, projects, runs);
    const runService = new AgentRunService(runs);
    const events = new AgentEventBroker();
    runService.setTransitionListener((run) => {
      const payload = progressPayload(run.status);
      if (payload)
        events.publish({
          type: 'run.progress',
          runId: run.id,
          pageId: run.pageId,
          requestId: run.clientRequestId,
          target: agentTarget(run.projectId, run.pageId),
          payload,
        });
    });
    const docs = new ProductDocsProvider();
    const context = new ContextAssembler(
      { getCurrent: getWorkingSchemaState },
      conversations,
      docs,
      {},
      projects.getPageRoles,
      loadMaterials,
      false,
    );
    const pi = createPiModels();
    const engine =
      input.agentEngine ??
      new PiAgentEngine({
        resolveModel: (provider, model) => pi.models.getModel(provider, model),
        stream: pi.models.streamSimple.bind(pi.models),
        getCredential: async (provider) =>
          provider === 'deepseek' ? input.getModelCredential?.(provider) : undefined,
      });
    const executor = new RunExecutor({
      projects: agentProjects,
      resolvePage,
      runs,
      conversations,
      runService,
      context,
      engine,
      createTools: (scope) => {
        const ids = createAgentElementIds();
        return createDefaultAgentToolEntries([
          ...createReadOnlyAgentTools(
            {
              runId: scope.runId,
              projectId: scope.projectId,
              pageId: scope.pageId,
              workingVersion: scope.baseWorkingVersion,
            },
            {
              projects: agentProjects,
              resolvePage,
              loadMaterials,
              getProjectRoles: projects.getPageRoles,
            },
            ids,
          ),
          ...createDomainAgentTools(scope, { projects: agentProjects, docs, diagnostics }),
          createValidatePageOperationsTool(agentProjects, scope, ids, resolvePage),
          createCompletePageRunTool(
            { projects: agentProjects, resolvePage, loadMaterials, runs, runService },
            scope,
            ids,
          ),
        ]);
      },
      audit: async (audit) => {
        await runs.appendAudit(audit);
        const run = await runs.get(audit.runId);
        if (run)
          events.publish({
            type: 'tool.activity',
            runId: run.id,
            pageId: run.pageId,
            requestId: run.clientRequestId,
            target: agentTarget(run.projectId, run.pageId),
            payload: {
              toolName: audit.toolName,
              phase: audit.phase,
              ...(audit.safeErrorCode ? { safeErrorCode: audit.safeErrorCode } : {}),
            },
          });
      },
    });
    const service = new AgentService({
      projects: agentProjects,
      runs,
      conversations,
      runService,
      events,
      executor,
      budget: resolveAgentRunBudget(
        process.env.ORIGAMIX_AGENT_BUDGET_PROFILE,
        process.env.ORIGAMIX_AGENT_BUDGET_JSON,
      ),
      getCurrentState: (projectId, pageId) => getWorking(projectId, pageId!),
    });
    await recoverAgentRunsOnStartup(runs, agentProjects, conversations, resolvePage);
    const template = input.templateDownload && {
      version: input.templateDownload.version,
      sha256: input.templateDownload.sha256,
    };
    server = createHttpServer({
      desktopToken: input.desktopToken,
      serviceInstanceId: input.serviceInstanceId,
      templateDownload: input.templateDownload,
      ...(template
        ? {
            projectSync: {
              identity: projects.syncIdentity,
              prepare: (projectId, targetId) => projects.prepareSync(projectId, targetId, template),
              finish: projects.finishSync,
              export: (projectId) => projects.exportProject(projectId, template),
            },
          }
        : {}),
      allowedOrigins: [],
      projects,
      projectService: projects,
      createDatabaseProject: projects.createDatabaseProject.bind(projects),
      resolveSchemaPage: projects.resolveSchemaPage,
      runtimeDiagnostics: diagnostics,
      agent: { conversations, runs: runService, events, service },
    });
    const listener = server;
    await listener.listen({ host: '127.0.0.1', port: 0 });
    const address = listener.server.address();
    if (!address || typeof address === 'string') throw new Error('无法取得 HTTP 服务端口');
    const ownership = owner;
    let closing: Promise<void> | undefined;
    const close = (): Promise<void> => {
      closing ??= (async () => {
        clearInterval(heartbeat);
        const agents = service.shutdown();
        await Promise.all([agents, listener.close()]);
        ownership.destroy();
        await pool.end();
      })().catch((error: unknown) => {
        closing = undefined;
        throw error;
      });
      return closing;
    };
    const leaseLost = () => {
      void close().catch(() => console.error('MySQL Web Agent 宿主关闭失败'));
    };
    // The lock belongs to this connection. Keep it active and fence the listener if it is lost.
    ownership.on('error', leaseLost);
    const heartbeat = setInterval(() => {
      void ownership.ping().catch(leaseLost);
    }, 15_000).unref();
    return { port: address.port, close };
  } catch (error) {
    await server?.close();
    owner?.destroy();
    await pool.end();
    throw error;
  }
};
