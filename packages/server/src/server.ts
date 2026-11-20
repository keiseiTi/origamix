import { createPageAgentEngine, createPageAgentRuntime } from './agent/page-agent-runtime';
import { sqliteAgentUsage } from './agent/agent-usage-repository';
import { AgentUsageService } from './agent/agent-usage-service';
import { ApplicationDatabase } from './database/database';
import { ProjectRepository } from './projects/project-repository';
import { AgentRunRepository } from './agent/run-repository';
import { ConversationRepository } from './conversations/conversation-repository';
import { ConversationService } from './conversations/conversation-service';
import { ProjectService } from './projects/project-service';
import { ProjectApplyService } from './schema/project-apply-service';
import { fileSchemaPageResolver, getWorkingSchemaState } from './schema/schema-service';
import { createHttpServer } from './http/server';
import { RuntimeDiagnosticCache } from './diagnostics/diagnostic-cache';
import { RuntimeDiagnosticService } from './diagnostics/diagnostic-service';
import { resolveAgentRunBudget } from './agent/run-budget';
import { DEEPSEEK_FLASH_MODEL_ID } from './agent/agent-engine';
import { AgentToolAuditRepository } from './agent/tool-audit-repository';

export const startServer = async (input: {
  port?: number;
  databasePath: string;
  templatePath: string;
  templateDownload?: import('./http/types').TemplateDownload;
  desktopToken: string;
  serviceInstanceId: string;
  projectPath?: string;
  allowedOrigins?: readonly string[];
  getModelCredential?: (provider: string) => Promise<string | undefined>;
  getModelReference?: () => Promise<string | undefined>;
}) => {
  const port = input.port ?? 1029;
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('后端端口必须为 0 到 65535 的整数');
  const agentBudget = resolveAgentRunBudget(
    process.env.ORIGAMIX_AGENT_BUDGET_PROFILE,
    process.env.ORIGAMIX_AGENT_BUDGET_JSON,
  );
  const database = new ApplicationDatabase(input.databasePath);
  let dispose: (() => Promise<void>) | undefined;
  try {
    const projects = new ProjectRepository(database);
    const conversations = new ConversationRepository(database);
    const usageRepository = sqliteAgentUsage(database);
    const runs = new AgentRunRepository(database);
    const toolAudits = new AgentToolAuditRepository(database);
    const conversationService = new ConversationService(database, projects, conversations, runs);
    const resolveSchemaPage = fileSchemaPageResolver(projects);
    const getCurrentRevision = (projectId: string, pageId: string) =>
      getWorkingSchemaState(resolveSchemaPage(projectId, pageId));
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
    const engine = createPageAgentEngine(input.getModelCredential);
    const getModelRef = async () => (await input.getModelReference?.()) ?? DEEPSEEK_FLASH_MODEL_ID;
    const agent = createPageAgentRuntime({
      projects,
      resolvePage: resolveSchemaPage,
      runs,
      conversations: conversationService,
      history: conversations,
      engine,
      diagnostics: runtimeDiagnostics,
      budget: agentBudget,
      getModelRef,
      getPageRoles: projectService.getPageRoles,
      getCurrentState: (projectId, pageId) => {
        if (!pageId) throw new Error('页面 ID 缺失');
        return getCurrentRevision(projectId, pageId);
      },
      recordReportedUsage: usageRepository.record,
      recordModelUsage: (runId, requestIndex, metrics) => {
        console.info(
          JSON.stringify({ event: 'agent.model_usage', runId, requestIndex, ...metrics }),
        );
      },
      audit: (event) => {
        toolAudits.append(event);
      },
    });
    const agentService = agent.http.service;
    const server = createHttpServer({
      ...input,
      host: 'desktop',
      projects,
      projectService,
      projectApplyService,
      agentUsage: new AgentUsageService(usageRepository, () => projects.listProjects()),
      runtimeDiagnostics,
      resolveSchemaPage,
      agent: agent.http,
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
    await agent.recover();
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
