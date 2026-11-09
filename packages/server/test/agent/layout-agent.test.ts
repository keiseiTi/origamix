import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { expect, it, vi } from 'vitest';
import type { SchemaOperation } from '@origamix/shared';
import { ApplicationDatabase } from '../../src/database/database';
import { ProjectRepository } from '../../src/projects/project-repository';
import { ProjectService } from '../../src/projects/project-service';
import { ProjectApplyService } from '../../src/schema/project-apply-service';
import { getWorkingSchemaState } from '../../src/schema/schema-service';
import { LayoutService } from '../../src/layout/layout-service';
import { loadLayoutMaterials } from '../../src/projects/project-materials';
import { ConversationRepository } from '../../src/conversations/conversation-repository';
import { ConversationService } from '../../src/conversations/conversation-service';
import { AgentRunRepository } from '../../src/agent/run-repository';
import { AgentRunService } from '../../src/agent/run-service';
import { AgentEventBroker } from '../../src/agent/event-broker';
import { AgentService } from '../../src/agent/agent-service';
import { RunExecutor } from '../../src/agent/run-executor';
import { ContextAssembler } from '../../src/agent/context-assembler';
import { ProductDocsProvider } from '../../src/agent/product-docs-provider';
import { createReadOnlyAgentTools } from '../../src/agent/tools/read-only-tools';
import { createCompletePageRunTool } from '../../src/agent/tools/complete-page-run';
import { createDefaultAgentToolEntries } from '../../src/agent/tools/registry';
import { hashOperations } from '../../src/agent/tools/operation-digest';
import { recoverAgentRunsOnStartup } from '../../src/agent/run-recovery';
import { createHttpServer } from '../../src/http/server';
import { FakeAgentEngine } from '../fixtures/fake-agent-engine';

// Page tests cannot prove layout ownership, its nullable checkpoint, or its
// separate durable commit receipt. Exercise these through the existing Run owner.
it('repairs and commits only the bound layout, isolates HTTP history, and recovers a durable layout commit', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'origamix-layout-agent-'));
  const databasePath = join(directory, 'state.db');
  let database = new ApplicationDatabase(databasePath);
  let server: ReturnType<typeof createHttpServer> | undefined;
  let service: AgentService | undefined;
  try {
    const projects = new ProjectRepository(database);
    const apply = new ProjectApplyService(projects);
    const projectService = new ProjectService(
      projects,
      fileURLToPath(new URL('../../../template', import.meta.url)),
      apply,
    );
    projectService.registerGrant('grant', directory);
    const project = await projectService.createProject({
      directoryGrantId: 'grant',
      name: 'Layout',
      code: 'layout-agent',
    });
    await projectService.setLayoutEnabled(project.id, true);
    const page = await projectService.createPage(project.id, { name: 'Home', slug: 'home' });
    const pageRef = { projectPath: project.path, pageId: page.id, slug: page.slug };
    const pageBefore = await getWorkingSchemaState(pageRef);
    const pageTarget = await readFile(join(project.path, 'src/pages/home/schema.json'), 'utf8');
    const layouts = new LayoutService(projects);
    const initial = await layouts.getWorking(project.id);
    const root = initial.document.schema.layout.root;
    const records = new ConversationRepository(database);
    const runs = new AgentRunRepository(database);
    const runService = new AgentRunService(runs);
    const conversations = new ConversationService(database, projects, records, runs);
    const events = new AgentEventBroker();
    const readLayout = async (projectId: string) => {
      const state = await layouts.getWorking(projectId);
      return { ...state, schema: state.document.schema };
    };
    const operations: SchemaOperation[] = [
      {
        operation: 'updateElementProps',
        elementId: root,
        set: { title: 'Draft layout', variant: 'side' },
      },
      {
        operation: 'updateElementProps',
        elementId: `${root}__header`,
        set: { headerBackground: '#1677ff' },
      },
      {
        operation: 'addElement',
        elementId: 'layout_title',
        parentId: `${root}__header`,
        element: { type: 'text', props: { text: 'Draft layout' } },
      },
    ];
    let calls = 0;
    const engine = new FakeAgentEngine(async (request) => {
      calls += 1;
      expect(request.systemPrompt).toContain('"kind":"layout"');
      expect(request.systemPrompt).toContain('complete_layout_run');
      expect(request.systemPrompt).toContain('系统名称/应用名称/站点标题');
      expect((request.tools ?? []).map((tool) => tool.name)).not.toContain('complete_page_run');
      expect((request.tools ?? []).map((tool) => tool.name)).not.toContain(
        'get_page_logic_context',
      );
      expect((request.tools ?? []).map((tool) => tool.name)).not.toContain('get_page_diagnostics');
      const tool = (request.tools ?? []).find((tool) => tool.name === 'complete_layout_run')!;
      const input = {
        outcome: 'apply_changes',
        operations:
          calls === 1
            ? [...operations, { operation: 'removeElement', elementId: 'outlet' }]
            : operations,
        response: '布局草稿已修改',
      };
      await request.onEvent?.({
        type: 'tool_start',
        toolCallId: `call_${calls}`,
        toolName: tool.name,
        input,
      });
      await expect(projectService.setLayoutEnabled(project.id, false)).rejects.toThrow('正在运行');
      try {
        const result = await tool.execute(input, request.signal!);
        await request.onEvent?.({
          type: 'tool_end',
          toolCallId: `call_${calls}`,
          toolName: tool.name,
          result,
          isError: false,
        });
      } catch (error) {
        expect(calls).toBe(1);
        expect((await layouts.getWorking(project.id)).workingVersion).toBe(1);
        await request.onEvent?.({
          type: 'tool_end',
          toolCallId: `call_${calls}`,
          toolName: tool.name,
          result: error,
          isError: true,
        });
      }
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
        readLayout,
      ),
      createTools: (scope) =>
        createDefaultAgentToolEntries([
          ...createReadOnlyAgentTools(
            {
              runId: scope.runId,
              projectId: scope.projectId,
              workingVersion: scope.baseWorkingVersion,
            },
            { projects, loadMaterials: loadLayoutMaterials, readLayout },
          ),
          createCompletePageRunTool(
            { projects, runs, runService, layouts, loadMaterials: loadLayoutMaterials },
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
      getCurrentState: (projectId) => readLayout(projectId),
    });
    const start = vi.spyOn(service, 'start');
    server = createHttpServer({
      desktopToken: 'fake-token',
      serviceInstanceId: 'test-instance',
      projects,
      projectService,
      projectApplyService: apply,
      layoutService: layouts,
      agent: { conversations, runs: runService, events, service },
    });
    const headers = { authorization: 'Bearer fake-token', 'x-origamix-service': 'test-instance' };
    const request = {
      version: '1' as const,
      projectId: project.id,
      target: { kind: 'layout' as const, projectId: project.id },
      clientRequestId: 'layout-request',
      baseWorkingVersion: 1,
      content: { version: '1' as const, blocks: [{ type: 'text' as const, text: '创建顶部布局' }] },
    };
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/layout/agent/runs/create',
          payload: request,
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/agent/runs/create',
          headers,
          payload: request,
        })
      ).statusCode,
    ).toBe(400);
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/layout/agent/runs/create',
      headers,
      payload: request,
    });
    expect(response.statusCode, response.body).toBe(202);
    const started = await start.mock.results.at(-1)!.value;
    expect(await started.completion).toMatchObject({
      status: 'completed',
      resultWorkingVersion: 2,
    });
    expect(calls).toBe(2);
    const working = await layouts.getWorking(project.id);
    expect(working).toMatchObject({ workingVersion: 2, revisionId: null });
    expect(working.document.schema.elements.layout_title?.props.text).toBe('Draft layout');
    expect(working.document.schema.elements[`${root}__header`]!.props.headerBackground).toBe(
      '#1677ff',
    );
    expect(await getWorkingSchemaState(pageRef)).toEqual(pageBefore);
    expect(await readFile(join(project.path, 'src/pages/home/schema.json'), 'utf8')).toBe(
      pageTarget,
    );
    expect(await readdir(join(project.path, 'src'))).not.toContain('origamix-layout');
    expect(await readdir(join(project.path, '.origamix/layout'))).not.toContain('revisions');
    expect((await service.start(request)).run.id).toBe(started.run.id);
    expect(calls).toBe(2);
    await expect(service.start({ ...request, clientRequestId: 'stale' })).rejects.toThrow('版本');
    const pageConversation = conversations.getOrCreateActive(project.id, page.id);
    await expect(
      service.start({
        ...request,
        clientRequestId: 'foreign',
        baseWorkingVersion: 2,
        conversationId: pageConversation.id,
      }),
    ).rejects.toThrow('会话');
    const list = await server.inject({
      method: 'POST',
      url: '/api/v1/layout/agent/conversations/list',
      headers,
      payload: { projectId: project.id },
    });
    expect(list.json().data.conversations).toHaveLength(1);
    expect(list.json().data.conversations[0]).toMatchObject({ target: request.target });
    expect(list.json().data.conversations[0].pageId).toBeUndefined();
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/api/v1/agent/runs/get',
          headers,
          payload: { projectId: project.id, runId: started.run.id },
        })
      ).statusCode,
    ).toBe(404);
    const stream = await server.inject({
      method: 'GET',
      url: `/api/v1/projects/${project.id}/layout/agent/runs/${started.run.id}/events`,
      headers,
    });
    expect(stream.body).toContain('"kind":"layout"');
    expect(stream.body).toContain('run.completed');
    expect(
      events
        .subscribe(started.run.id, -1, () => undefined)
        .replay.some((event) => event.type === 'working.committed'),
    ).toBe(true);
    await service.shutdown();
    await server.close();
    server = undefined;
    const pending = conversations.startRun({
      ...request,
      clientRequestId: 'recover',
      baseWorkingVersion: 2,
      conversationId: started.conversationId,
      modelRef: 'deepseek/deepseek-flash',
      runKind: 'layout_assistant',
      budget: started.run.budget,
      promptVersion: '5',
      toolsetVersion: '3',
      policyVersion: '1',
      materialManifestVersion: started.run.materialManifestVersion,
    });
    const update: SchemaOperation[] = [
      {
        operation: 'updateElementProps',
        elementId: 'layout_title',
        set: { text: 'Recovered layout' },
      },
    ];
    for (const status of ['preparing', 'reasoning', 'reading', 'deciding'] as const)
      runService.transition(pending.run.id, status);
    runService.transition(pending.run.id, 'validating', {
      operationDigest: hashOperations(update),
      outcomeJson: { response: '已恢复布局' },
    });
    await layouts.applyAgentOperations(
      {
        projectId: project.id,
        baseWorkingVersion: 2,
        clientRequestId: pending.run.id,
        operations: update,
      },
      {
        runId: pending.run.id,
        operationDigest: hashOperations(update),
        beforeWrite: () => undefined,
        maxSchemaBytes: 512 * 1024,
      },
    );
    database.close();
    database = new ApplicationDatabase(databasePath);
    const reopenedProjects = new ProjectRepository(database),
      reopenedRuns = new AgentRunRepository(database);
    const reopenedConversations = new ConversationService(
      database,
      reopenedProjects,
      new ConversationRepository(database),
      reopenedRuns,
    );
    await recoverAgentRunsOnStartup(
      reopenedRuns,
      reopenedProjects,
      reopenedConversations,
      new LayoutService(reopenedProjects),
    );
    expect(reopenedRuns.get(pending.run.id)).toMatchObject({
      status: 'completed',
      recoveredCommit: true,
      resultWorkingVersion: 3,
    });
    expect(
      reopenedConversations.history(project.id, undefined, started.conversationId).at(-1)?.content
        .blocks[0],
    ).toMatchObject({ text: '已恢复布局' });
  } finally {
    await service?.shutdown();
    await server?.close();
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
