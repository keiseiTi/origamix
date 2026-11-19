import { createPageAgentEngine, createPageAgentRuntime } from '../agent/page-agent-runtime';
import { mysqlAgentUsage } from '../agent/agent-usage-repository';
import { AgentUsageService } from '../agent/agent-usage-service';
import type { RowDataPacket } from 'mysql2/promise';
import { MysqlAgentRunRepository } from '../agent/mysql-agent-repository';
import { resolveAgentRunBudget } from '../agent/run-budget';
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
    const resolvePage = projects.resolveSchemaPage;
    const getWorking = (projectId: string, pageId: string) =>
      getWorkingSchemaState(resolvePage(projectId, pageId));
    const loadMaterials = async (projectId: string) =>
      getManifestMaterials(await projects.readManifest(projectId));
    const diagnostics = new RuntimeDiagnosticService(
      undefined,
      new RuntimeDiagnosticCache(),
      getWorking,
    );
    const usageRepository = mysqlAgentUsage(pool);
    const runs = new MysqlAgentRunRepository(pool);
    const conversations = new MysqlConversationService(pool, projects, runs);
    const agent = createPageAgentRuntime({
      projects: agentProjects,
      resolvePage,
      runs,
      conversations,
      history: conversations,
      diagnostics,
      loadMaterials,
      getPageRoles: projects.getPageRoles,
      engine: input.agentEngine ?? createPageAgentEngine(input.getModelCredential),
      audit: (event) => runs.appendAudit(event),
      recordReportedUsage: usageRepository.record,
      budget: resolveAgentRunBudget(
        process.env.ORIGAMIX_AGENT_BUDGET_PROFILE,
        process.env.ORIGAMIX_AGENT_BUDGET_JSON,
      ),
      getCurrentState: (projectId, pageId) => {
        if (!pageId) throw new Error('页面 ID 缺失');
        return getWorking(projectId, pageId);
      },
    });
    await agent.recover();
    const template = input.templateDownload && {
      version: input.templateDownload.version,
      sha256: input.templateDownload.sha256,
    };
    server = createHttpServer({
      host: 'web',
      desktopToken: input.desktopToken,
      serviceInstanceId: input.serviceInstanceId,
      templateDownload: input.templateDownload,
      ...(template
        ? {
            exportProject: (projectId: string) => projects.exportProject(projectId, template),
          }
        : {}),
      allowedOrigins: [],
      projects,
      projectService: projects,
      createDatabaseProject: projects.createDatabaseProject.bind(projects),
      resolveSchemaPage: projects.resolveSchemaPage,
      agentUsage: new AgentUsageService(usageRepository, () => projects.listProjects()),
      runtimeDiagnostics: diagnostics,
      agent: agent.http,
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
        const agents = agent.http.service.shutdown();
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
