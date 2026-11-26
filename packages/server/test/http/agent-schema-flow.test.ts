import { AgentUsageService } from '@/agent/agent-usage-service';
import { sqliteAgentUsage } from '@/agent/agent-usage-repository';
import { createAgentElementIds } from '@/agent/tools/element-ids';
import { loadProjectMaterials } from '@/projects/project-materials';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it, vi } from 'vitest';
import { createModels } from '@earendil-works/pi-ai';
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from '@earendil-works/pi-ai/providers/faux';
import type { PageFlow, SchemaOperation } from '@origamix/shared';
import { ApplicationDatabase } from '@/database/database';
import { ProjectRepository } from '@/projects/project-repository';
import { ProjectService } from '@/projects/project-service';
import { ProjectApplyService } from '@/schema/project-apply-service';
import { getWorkingSchemaState } from '@/schema/schema-service';
import { AgentRunRepository } from '@/agent/run-repository';
import { AgentRunService } from '@/agent/run-service';
import { AgentService } from '@/agent/agent-service';
import { AgentEventBroker } from '@/agent/event-broker';
import { RunExecutor } from '@/agent/run-executor';
import { ContextAssembler } from '@/agent/context-assembler';
import { ProductDocsProvider } from '@/agent/product-docs-provider';
import { ConversationRepository } from '@/conversations/conversation-repository';
import { ConversationService } from '@/conversations/conversation-service';
import { createDefaultAgentToolEntries } from '@/agent/tools/registry';
import { createCompletePageRunTool } from '@/agent/tools/complete-page-run';
import { PiAgentEngine } from '@/agent/pi-agent-engine';
import { createReadOnlyAgentTools } from '@/agent/tools/read-only-tools';
import { createHttpServer } from '@/http/server';
import { createLogger } from '@/logging/logger';

it('commits an Agent edit through HTTP, rejects a foreign Apply, and applies only explicitly', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'origamix-agent-flow-'));
  const database = new ApplicationDatabase(':memory:');
  let server: ReturnType<typeof createHttpServer> | undefined;
  try {
    const logLines: string[] = [];
    const logger = createLogger('desktop', 'test-instance', {
      write(line) {
        logLines.push(line);
        if (line.includes('"event":"working.commit.completed"'))
          throw new Error('simulated log destination failure');
      },
    });
    const projects = new ProjectRepository(database);
    const projectApplyService = new ProjectApplyService(projects);
    const projectService = new ProjectService(
      projects,
      fileURLToPath(new URL('../../../template', import.meta.url)),
      projectApplyService,
    );
    projectService.registerGrant('test-grant', directory);
    const project = await projectService.createProject({
      directoryGrantId: 'test-grant',
      name: 'Test',
      code: 'agent-flow',
    });
    const page = await projectService.createPage(project.id, { name: 'Home', slug: 'home' });
    const pageRef = { projectPath: project.path, pageId: page.id, slug: page.slug };
    const before = await getWorkingSchemaState(pageRef);
    const target = join(project.path, 'src', 'pages', page.slug, 'schema.json');
    const originalTarget = await readFile(target, 'utf8');
    const runs = new AgentRunRepository(database);
    const runService = new AgentRunService(runs);
    const conversationRecords = new ConversationRepository(database);
    const conversations = new ConversationService(database, projects, conversationRecords, runs);
    const events = new AgentEventBroker();
    const elementIds = createAgentElementIds();
    const buttonId = elementIds.allocate('button');
    expect(buttonId).toMatch(/^button_[A-Za-z0-9_-]{8}$/);
    const flow: PageFlow = {
      startId: 'start',
      nodes: {
        start: { id: 'start', type: 'start', props: {}, prev: [], next: ['action'] },
        action: {
          id: 'action',
          type: 'visibleElement',
          prev: ['start'],
          next: [],
          props: { elementIds: [buttonId], value: { type: 'boolean', value: false } },
        },
      },
    };
    const operations: SchemaOperation[] = [
      {
        operation: 'updateElementProps',
        elementId: before.schema.layout.root,
        set: { padding: 16 },
      },
      {
        operation: 'addElement',
        elementId: buttonId,
        element: { type: 'button', props: { text: '隐藏' } },
        parentId: before.schema.layout.root,
      },
      { operation: 'addFlow', flowId: 'flow_agent', flow },
      {
        operation: 'setElementEventBinding',
        elementId: buttonId,
        event: 'onClick',
        flowId: 'flow_agent',
      },
    ];
    const faux = fauxProvider({ provider: 'deepseek', tokensPerSecond: 100_000 });
    faux.setResponses([
      fauxAssistantMessage(
        fauxToolCall('complete_page_run', {
          outcome: 'apply_changes',
          operations: JSON.parse(JSON.stringify(operations)),
          response: '已生成隐藏按钮的点击逻辑',
        }),
        { stopReason: 'toolUse' },
      ),
    ]);
    const models = createModels();
    models.setProvider(faux.provider);
    const engine = new PiAgentEngine({
      resolveModel: () => faux.getModel(),
      getCredential: async () => 'fake-secret',
      stream: (model, context, options) => models.streamSimple(model, context, options),
    });
    const usageRepository = sqliteAgentUsage(database);
    const executor = new RunExecutor({
      recordReportedUsage: usageRepository.record,
      projects,
      runs,
      runService,
      conversations,
      engine,
      context: new ContextAssembler(
        { getCurrent: getWorkingSchemaState },
        conversationRecords,
        new ProductDocsProvider(),
      ),
      createTools: (scope) =>
        createDefaultAgentToolEntries([
          ...createReadOnlyAgentTools(
            {
              runId: scope.runId,
              projectId: scope.projectId,
              pageId: scope.pageId,
              workingVersion: scope.baseWorkingVersion,
            },
            { projects, loadMaterials: loadProjectMaterials },
            elementIds,
          ),
          createCompletePageRunTool(
            { projects, runs, runService, logger, loadMaterials: loadProjectMaterials },
            { ...scope, maxSchemaBytes: 256 * 1024 },
            elementIds,
          ),
        ]),
    });
    const service = new AgentService({
      logger,
      projects,
      runs,
      runService,
      conversations,
      events,
      executor,
      getCurrentState: async () => getWorkingSchemaState(pageRef),
      getModelRef: async () => 'deepseek/deepseek-v4-pro',
    });
    const start = vi.spyOn(service, 'start');
    server = createHttpServer({
      logger,
      host: 'desktop',
      desktopToken: 'fake-desktop-token',
      serviceInstanceId: 'test-instance',
      projects,
      projectService,
      projectApplyService,
      agentUsage: new AgentUsageService(usageRepository, () => projects.listProjects()),
      agent: { conversations, runs: runService, events, service },
    });
    const headers = {
      authorization: 'Bearer fake-desktop-token',
      'x-origamix-service': 'test-instance',
    };
    const request = {
      version: '1',
      projectId: project.id,
      pageId: page.id,
      baseWorkingVersion: (await getWorkingSchemaState(pageRef)).workingVersion,
      clientRequestId: 'agent-edit',
      content: { version: '1', blocks: [{ type: 'text', text: '创建一个按钮，点击后隐藏自己' }] },
    };
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/agent/runs/create',
      headers: { ...headers, 'x-request-id': 'caller-controlled-id' },
      payload: request,
    });
    expect(response.statusCode).toBe(202);
    const started = await start.mock.results[0]!.value;
    const result = await started.completion;
    expect(result, runs.get(started.run.id)?.errorMessage).toMatchObject({
      status: 'completed',
      resultWorkingVersion: expect.any(Number),
    });
    const activity = await server.inject({
      method: 'POST',
      url: '/api/v1/agent/pages/activity',
      headers,
      payload: { projectId: project.id, pageId: page.id },
    });
    expect(activity.json().data).toEqual({
      version: '1',
      activeRun: null,
      committedWorkingVersion: result?.resultWorkingVersion,
    });
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/agent/pages/activity',
          headers,
          payload: { projectId: 'project_other', pageId: page.id },
        })
      ).statusCode,
    ).toBe(404);
    const requestId = response.headers['x-request-id'];
    expect(requestId).toEqual(expect.any(String));
    expect(requestId).not.toBe('caller-controlled-id');
    expect(logLines.map((line) => JSON.parse(line) as unknown)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'http.request.completed', requestId, statusCode: 202 }),
        expect.objectContaining({ event: 'agent.run.accepted', requestId, runId: started.run.id }),
        expect.objectContaining({
          event: 'working.commit.completed',
          runId: started.run.id,
          result: 'committed',
          resultWorkingVersion: result?.resultWorkingVersion,
        }),
      ]),
    );
    expect(logLines.join('')).not.toMatch(
      /caller-controlled-id|fake-secret|fake-desktop-token|创建一个按钮/,
    );
    const usageScope = { projectId: project.id, pageId: page.id };
    const usageResponse = await server.inject({
      method: 'POST',
      url: '/api/v1/agent/usage/page',
      headers,
      payload: { ...usageScope, timeZone: 'Asia/Shanghai' },
    });
    expect(usageResponse.statusCode).toBe(200);
    const { total, today } = usageResponse.json().data;
    expect(total).toEqual(today);
    expect(today.inputTokens).toBeGreaterThan(0);
    expect(today.outputTokens).toBeGreaterThan(0);
    expect(today.incompleteRuns).toBe(0);
    const daily = await server.inject({
      method: 'POST',
      url: '/api/v1/agent/usage/daily',
      headers,
      payload: { days: 7, scope: usageScope, timeZone: 'Asia/Shanghai' },
    });
    expect(daily.json().data).toMatchObject({
      today,
      projects: [{ projectId: project.id, pages: [{ pageId: page.id, ...today }] }],
    });
    const foreignUsage = await server.inject({
      method: 'POST',
      url: '/api/v1/agent/usage/page',
      headers,
      payload: { ...usageScope, projectId: 'project_foreign', timeZone: 'Asia/Shanghai' },
    });
    expect(foreignUsage.statusCode).toBe(404);

    let edited = await getWorkingSchemaState(pageRef);
    expect(edited.revisionId).toBe(before.revisionId);
    expect(edited.schema.flows.flow_agent).toEqual(flow);
    expect(edited.schema.bindElements).toEqual([
      { id: buttonId, event: 'onClick', flowId: 'flow_agent' },
    ]);
    expect((await getWorkingSchemaState(pageRef)).workingVersion).toBe(
      request.baseWorkingVersion + 1,
    );
    expect(await readFile(target, 'utf8')).toBe(originalTarget);
    const revisions = join(project.path, '.origamix', 'revisions', page.id);
    expect(await readdir(revisions)).toHaveLength(1);

    const staleAgent = await server.inject({
      method: 'POST',
      url: '/api/v1/agent/runs/create',
      headers,
      payload: { ...request, clientRequestId: 'stale-agent-edit' },
    });
    expect(staleAgent.statusCode).toBe(409);
    const evidence = {
      type: 'runtime_repair',
      snapshotId: 'preview',
      runtimeSessionId: 'runtime',
      executionId: 1,
      workingHash: edited.workingHash,
      elementId: buttonId,
      flowId: 'flow_agent',
      nodeId: 'action',
      visited: ['start'],
      durationMs: 1,
      failure: { code: 'NODE_EXECUTION_ERROR' },
    };
    const evidenceVersion = edited.workingVersion;
    const attemptRepair = (block: typeof evidence) =>
      server!.inject({
        method: 'POST',
        url: '/api/v1/agent/runs/create',
        headers,
        payload: {
          ...request,
          baseWorkingVersion: evidenceVersion,
          clientRequestId: 'runtime-repair',
          content: { version: '1', blocks: [...request.content.blocks, block] },
        },
      });
    expect((await attemptRepair({ ...evidence, workingHash: '0'.repeat(64) })).statusCode).toBe(
      409,
    );
    expect((await attemptRepair({ ...evidence, nodeId: 'foreign-node' })).statusCode).toBe(409);
    expect((await getWorkingSchemaState(pageRef)).workingVersion).toBe(edited.workingVersion);

    const staleCanvas = await server.inject({
      method: 'POST',
      url: '/api/v1/pages/working-operations/apply',
      headers,
      payload: {
        projectId: project.id,
        pageId: page.id,
        baseWorkingVersion: request.baseWorkingVersion,
        operations: [
          {
            operation: 'updateElementProps',
            elementId: edited.schema.layout.root,
            set: { height: 32 },
          },
        ],
      },
    });
    expect(staleCanvas.statusCode).toBe(409);
    expect((await getWorkingSchemaState(pageRef)).schema).toEqual(edited.schema);

    faux.setResponses([
      fauxAssistantMessage(
        fauxToolCall('complete_page_run', {
          outcome: 'apply_changes',
          operations: [
            { operation: 'updateElementProps', elementId: buttonId, set: { text: '已修复' } },
          ],
          response: '已更新故障按钮的草稿配置',
        }),
        { stopReason: 'toolUse' },
      ),
    ]);
    const repairedResponse = await attemptRepair(evidence);
    expect(repairedResponse.statusCode).toBe(202);
    const repairStarted = await start.mock.results.at(-1)!.value;
    await repairStarted.completion;
    const repaired = await getWorkingSchemaState(pageRef);
    expect(repaired.workingVersion).toBe(edited.workingVersion + 1);
    expect(repaired.schema.elements[buttonId]?.props.text).toBe('已修复');
    expect(await readFile(target, 'utf8')).toBe(originalTarget);
    expect((await attemptRepair(evidence)).json().data.runId).toBe(
      repairedResponse.json().data.runId,
    );
    expect((await attemptRepair({ ...evidence, durationMs: 2 })).statusCode).toBe(409);
    edited = repaired;

    const working = await getWorkingSchemaState(pageRef);
    const checkpoint = await server.inject({
      method: 'POST',
      url: '/api/v1/pages/revisions/save',
      headers,
      payload: {
        projectId: project.id,
        pageId: page.id,
        expectedWorkingVersion: working.workingVersion,
      },
    });
    expect(checkpoint.statusCode).toBe(200);
    const saved = checkpoint.json().data as { revisionId: string; workingVersion: number };
    expect(saved.workingVersion).toBeGreaterThan(working.workingVersion);
    expect(saved.revisionId).not.toBe(before.revisionId);
    const foreign = await server.inject({
      method: 'POST',
      url: '/api/v1/pages/apply',
      headers,
      payload: {
        pageId: page.id,
        expectedRevisionId: saved.revisionId,
        expectedWorkingVersion: saved.workingVersion,
        clientRequestId: 'foreign-apply',
        projectId: 'project_other',
      },
    });
    expect(foreign.statusCode).toBe(404);
    expect(await readFile(target, 'utf8')).toBe(originalTarget);
    const applied = await server.inject({
      method: 'POST',
      url: '/api/v1/pages/apply',
      headers,
      payload: {
        projectId: project.id,
        pageId: page.id,
        expectedRevisionId: saved.revisionId,
        expectedWorkingVersion: saved.workingVersion,
        clientRequestId: 'explicit-apply',
      },
    });
    expect(applied.statusCode).toBe(200);
    expect(JSON.parse(await readFile(target, 'utf8'))).toEqual(edited.schema);
    expect((await getWorkingSchemaState(pageRef)).revisionId).toBe(saved.revisionId);
    expect(await readdir(revisions)).toHaveLength(2);
  } finally {
    await server?.close();
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
