import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { expect, it, vi } from 'vitest';
import { ApplicationDatabase } from '../../src/database/database';
import { ProjectRepository } from '../../src/projects/project-repository';
import { ProjectService } from '../../src/projects/project-service';
import { AgentRunRepository } from '../../src/agent/run-repository';
import { AgentRunService } from '../../src/agent/run-service';
import { ConversationRepository } from '../../src/conversations/conversation-repository';
import { ConversationService } from '../../src/conversations/conversation-service';
import { AgentEventBroker } from '../../src/agent/event-broker';
import { AgentService } from '../../src/agent/agent-service';
import { ProjectTaskService } from '../../src/agent/project-task-service';
import { RunExecutor } from '../../src/agent/run-executor';
import { ContextAssembler } from '../../src/agent/context-assembler';
import { ProductDocsProvider } from '../../src/agent/product-docs-provider';
import { createCompletePageRunTool } from '../../src/agent/tools/complete-page-run';
import { createDefaultAgentToolEntries } from '../../src/agent/tools/registry';
import { loadProjectMaterials } from '../../src/projects/project-materials';
import {
  getWorkingSchemaState,
  listRevisionHistory,
  updateWorkingSchema,
} from '../../src/schema/schema-service';
import { ProjectTaskStore } from '../../src/projects/project-task-store';
import { createHttpServer } from '../../src/http/server';
import { FakeAgentEngine } from '../fixtures/fake-agent-engine';

// Existing page Run tests cannot prove confirmation ordering or cross-resource recovery.
it('persists project proposals, stops cancellation/conflicts, and resumes exactly one existing page Run after project commit', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'origamix-project-task-'));
  const database = new ApplicationDatabase(join(directory, 'state.db'));
  let service: AgentService | undefined;
  let http: ReturnType<typeof createHttpServer> | undefined;
  try {
    const projects = new ProjectRepository(database);
    const projectService = new ProjectService(
      projects,
      fileURLToPath(new URL('../../../template', import.meta.url)),
    );
    projectService.registerGrant('grant', directory);
    const project = await projectService.createProject({
      directoryGrantId: 'grant',
      name: 'Task',
      code: 'task',
    });
    const page = await projectService.createPage(project.id, { name: 'Page', slug: 'home' });
    const pageRef = { projectPath: project.path, pageId: page.id, slug: page.slug };
    const records = new ConversationRepository(database);
    const runs = new AgentRunRepository(database);
    const runService = new AgentRunService(runs);
    const conversations = new ConversationService(database, projects, records, runs);
    const events = new AgentEventBroker();
    const before = await getWorkingSchemaState(pageRef);
    const revisions = await listRevisionHistory(pageRef);
    const target = await readFile(join(project.path, 'src/pages/home/schema.json'), 'utf8');
    let pageCalls = 0;
    const engine = new FakeAgentEngine(async (request) => {
      const tool = request.tools!.find((item) => item.name === 'complete_page_run')!;
      const continued = request.prompt.includes('本轮只执行以下当前页面任务');
      if (continued) {
        pageCalls++;
        expect((await projectService.getPageRoles(project.id)).roles.assignments.login).toBe(
          page.id,
        );
        expect(request.systemPrompt).toContain('"projectRole":"login"');
      }
      const input = continued
        ? {
            outcome: 'apply_changes',
            operations: [
              {
                operation: 'addElement',
                elementId: 'login_title',
                parentId: before.schema.layout.root,
                element: { type: 'text', props: { text: '登录' } },
              },
            ],
            response: '页面草稿已更新',
          }
        : {
            outcome: 'propose_project',
            projectOperations: [{ type: 'pageRole.assign', roleId: 'login', pageId: page.id }],
            pageIntent: '添加登录标题',
            response: '已生成项目角色提案，请确认。',
          };
      await request.onEvent?.({
        type: 'tool_start',
        toolCallId: 'terminal',
        toolName: tool.name,
        input,
      });
      const result = await tool.execute(input, request.signal!);
      await request.onEvent?.({
        type: 'tool_end',
        toolCallId: 'terminal',
        toolName: tool.name,
        result,
        isError: false,
      });
      return { text: '', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } };
    });
    const executor = new RunExecutor({
      projects,
      runs,
      runService,
      conversations,
      engine,
      context: new ContextAssembler(
        { getCurrent: getWorkingSchemaState },
        records,
        new ProductDocsProvider(),
        {},
        projectService.getPageRoles,
      ),
      createTools: (scope) =>
        createDefaultAgentToolEntries([
          createCompletePageRunTool(
            {
              projects,
              runs,
              runService,
              loadMaterials: loadProjectMaterials,
              prepareProject: (...args) => tasks.prepare(...args),
            },
            scope,
          ),
        ]),
    });
    service = new AgentService({
      projects,
      runs,
      runService,
      conversations,
      events,
      executor,
      modelRef: 'fake/deterministic',
      getCurrentState: () => getWorkingSchemaState(pageRef),
      authorizeStart: (input) => tasks.assertContinuation(input),
    });
    const tasks: ProjectTaskService = new ProjectTaskService({
      projects,
      projectService,
      runs,
      getWorkingVersion: async () => (await getWorkingSchemaState(pageRef)).workingVersion,
      startPage: (input) => service!.start(input),
    });
    const propose = async (id: string) => {
      const working = await getWorkingSchemaState(pageRef);
      const started = await service!.start({
        version: '1',
        projectId: project.id,
        pageId: page.id,
        clientRequestId: id,
        baseWorkingVersion: working.workingVersion,
        content: { version: '1', blocks: [{ type: 'text', text: '设为登录页并添加标题' }] },
      });
      await started.completion;
      expect(runs.get(started.run.id)?.outcome).toBe('needs_project_confirmation');
      return { projectId: project.id, pageId: page.id, runId: started.run.id };
    };
    const cancelled = await propose('cancelled');
    expect((await getWorkingSchemaState(pageRef)).workingVersion).toBe(before.workingVersion);
    expect((await projectService.getPageRoles(project.id)).roles.assignments).toEqual({});
    const parentRun = runs.get(cancelled.runId)!;
    await expect(
      service.start({
        version: '1',
        projectId: project.id,
        pageId: page.id,
        conversationId: parentRun.conversationId,
        clientRequestId: `project_${parentRun.id}`,
        retryOfRunId: parentRun.id,
        baseWorkingVersion: parentRun.baseWorkingVersion,
        content: { version: '1', blocks: [{ type: 'text', text: '伪造继续' }] },
      }),
    ).rejects.toThrow('尚未确认');
    await tasks.decide({ ...cancelled, decision: 'cancel' });
    await expect(tasks.decide({ ...cancelled, decision: 'confirm' })).rejects.toThrow('取消');
    expect(pageCalls).toBe(0);
    const stale = await propose('stale');
    await projectService.renameProject(project.id, 'Changed');
    expect((await tasks.decide({ ...stale, decision: 'confirm' })).phase).toBe('project_failed');
    expect(pageCalls).toBe(0);
    const scope = await propose('confirmed');
    await expect(tasks.get({ ...scope, pageId: 'page_other' })).rejects.toThrow();
    const storeWrite = ProjectTaskStore.prototype.write;
    const fail = vi.spyOn(ProjectTaskStore.prototype, 'write').mockImplementation(async function (
      this: ProjectTaskStore,
      path,
      state,
    ) {
      if (state.phase === 'project_applied') throw new Error('interrupted after project commit');
      return storeWrite.call(this, path, state);
    });
    await expect(tasks.decide({ ...scope, decision: 'confirm' })).rejects.toThrow('interrupted');
    fail.mockRestore();
    expect((await projectService.getPageRoles(project.id)).roles.assignments.login).toBe(page.id);
    expect(pageCalls).toBe(0);
    const recovered = new ProjectTaskService({
      projects,
      projectService,
      runs,
      getWorkingVersion: async () => (await getWorkingSchemaState(pageRef)).workingVersion,
      startPage: (input) => service!.start(input),
    });
    expect((await recovered.get(scope)).phase).toBe('applying_project');
    const results = await Promise.all([
      recovered.decide({ ...scope, decision: 'confirm' }),
      recovered.decide({ ...scope, decision: 'confirm' }),
    ]);
    expect(results[0]!.childRunId).toBe(results[1]!.childRunId);
    const child = runs.get(results[0]!.childRunId!)!;
    const resumed = await service.start({
      version: '1',
      projectId: project.id,
      pageId: page.id,
      conversationId: child.conversationId,
      clientRequestId: child.clientRequestId,
      retryOfRunId: scope.runId,
      baseWorkingVersion: child.baseWorkingVersion,
      content: {
        version: '1',
        blocks: [
          {
            type: 'text',
            text: '项目配置已经由用户确认并成功保存。本轮只执行以下当前页面任务，不再提议项目操作：\n添加登录标题',
          },
        ],
      },
    });
    await resumed.completion;
    expect(pageCalls).toBe(1);
    expect(records.getMessage(child.userMessageId)?.role).toBe('system');
    expect((await recovered.get(scope)).phase).toBe('completed');
    expect((await getWorkingSchemaState(pageRef)).workingVersion).toBe(before.workingVersion + 1);
    expect(await listRevisionHistory(pageRef)).toEqual(revisions);
    expect(await readFile(join(project.path, 'src/pages/home/schema.json'), 'utf8')).toBe(target);
    const outdated = await propose('outdated');
    const working = await getWorkingSchemaState(pageRef);
    await updateWorkingSchema(pageRef, {
      baseWorkingVersion: working.workingVersion,
      schema: {
        ...working.schema,
        elements: {
          ...working.schema.elements,
          login_title: { type: 'text', props: { text: '用户修改' } },
        },
      },
    });
    expect((await recovered.decide({ ...outdated, decision: 'confirm' })).phase).toBe(
      'project_failed',
    );
    expect(pageCalls).toBe(1);
    http = createHttpServer({
      desktopToken: 'fake',
      serviceInstanceId: 'instance',
      projects,
      projectService,
      projectTasks: tasks,
      agent: { conversations, runs: runService, events, service },
    });
    expect(
      (await http.inject({ method: 'POST', url: '/api/v1/agent/project-task/get', payload: scope }))
        .statusCode,
    ).toBe(401);
    expect(
      (
        await http.inject({
          method: 'POST',
          url: '/api/v1/agent/project-task/get',
          headers: { authorization: 'Bearer fake', 'x-origamix-service': 'instance' },
          payload: scope,
        })
      ).json().data.phase,
    ).toBe('completed');
  } finally {
    await service?.shutdown();
    await http?.close();
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
