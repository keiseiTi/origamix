import { loadProjectMaterials } from '../../src/projects/project-materials';
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
import { ApplicationDatabase } from '../../src/database/database';
import { ProjectRepository } from '../../src/projects/project-repository';
import { ProjectService } from '../../src/projects/project-service';
import { ProjectApplyService } from '../../src/schema/project-apply-service';
import {
  getSchema,
  getWorkingSchemaState,
  saveWorkingRevision,
} from '../../src/schema/schema-service';
import { AgentRunRepository } from '../../src/agent/run-repository';
import { AgentRunService } from '../../src/agent/run-service';
import { AgentService } from '../../src/agent/agent-service';
import { AgentEventBroker } from '../../src/agent/event-broker';
import { RunExecutor } from '../../src/agent/run-executor';
import { ContextAssembler } from '../../src/agent/context-assembler';
import { ProductDocsProvider } from '../../src/agent/product-docs-provider';
import { ConversationRepository } from '../../src/conversations/conversation-repository';
import { ConversationService } from '../../src/conversations/conversation-service';
import { createDefaultAgentToolEntries } from '../../src/agent/tools/registry';
import { createCompletePageRunTool } from '../../src/agent/tools/complete-page-run';
import { PiAgentEngine } from '../../src/agent/pi-agent-engine';
import { createReadOnlyAgentTools } from '../../src/agent/tools/read-only-tools';
import { createHttpServer } from '../../src/http/server';

it('reports the invalid terminal field so a rejected reset can be repaired', async () => {
  const tool = createCompletePageRunTool(
    {
      projects: {} as never,
      runs: {} as never,
      runService: {} as never,
      loadMaterials: loadProjectMaterials,
    },
    {
      runId: 'run_test',
      messageId: 'message_test',
      projectId: 'project_test',
      pageId: 'page_test',
      baseWorkingVersion: 1,
      maxSchemaBytes: 1024,
      maxRepairAttempts: 1,
    },
  );
  await expect(
    tool.execute(
      {
        outcome: 'apply_changes',
        operations: [
          { operation: 'removeElement', elementId: 'form_main', removeDescendants: true },
        ],
      },
      new AbortController().signal,
    ),
  ).rejects.toThrow('/response');
  await expect(
    tool.execute(
      { outcome: 'no_change_needed', reason: '无法重置', response: '页面无需修改' },
      new AbortController().signal,
    ),
  ).rejects.toThrow('不能报告无需修改');
});

it('commits an Agent edit through HTTP once, rejects stale/foreign writes, and applies only explicitly', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'origamix-agent-flow-'));
  const database = new ApplicationDatabase(':memory:');
  let server: ReturnType<typeof createHttpServer> | undefined;
  try {
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
    const before = await getSchema(pageRef);
    const target = join(project.path, 'src', 'pages', page.slug, 'schema.json');
    const originalTarget = await readFile(target, 'utf8');
    const runs = new AgentRunRepository(database);
    const runService = new AgentRunService(runs);
    const conversationRecords = new ConversationRepository(database);
    const conversations = new ConversationService(database, projects, conversationRecords, runs);
    const events = new AgentEventBroker();
    const flow: PageFlow = {
      startId: 'start',
      nodes: {
        start: { id: 'start', type: 'start', props: {}, prev: [], next: ['action'] },
        action: {
          id: 'action',
          type: 'visibleElement',
          prev: ['start'],
          next: [],
          props: { elementIds: ['button_agent'], value: { type: 'boolean', value: false } },
        },
      },
    };
    const operations: SchemaOperation[] = [
      { operation: 'updateElementProps', elementId: 'element_root', set: { padding: 16 } },
      {
        operation: 'addElement',
        elementId: 'button_agent',
        element: { type: 'button', props: { text: '隐藏' } },
        parentId: 'element_root',
      },
      { operation: 'addFlow', flowId: 'flow_agent', flow },
      {
        operation: 'setElementEventBinding',
        elementId: 'button_agent',
        event: 'onClick',
        flowId: 'flow_agent',
      },
    ];
    const rejected = structuredClone(operations);
    if (rejected[2]?.operation === 'addFlow')
      rejected[2].flow.nodes.action!.props.elementIds = ['missing'];
    const faux = fauxProvider({ provider: 'deepseek', tokensPerSecond: 100_000 });
    faux.setResponses([
      fauxAssistantMessage(fauxToolCall('get_page_logic_context', {}), { stopReason: 'toolUse' }),
      fauxAssistantMessage(fauxToolCall('get_flow_node_manifest', { type: 'visibleElement' }), {
        stopReason: 'toolUse',
      }),
      fauxAssistantMessage(
        fauxToolCall('complete_page_run', {
          outcome: 'apply_changes',
          operations: JSON.parse(JSON.stringify(rejected)),
          response: '已生成',
        }),
        { stopReason: 'toolUse' },
      ),
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
    const providerInputs: string[] = [];
    const engine = new PiAgentEngine({
      resolveModel: () => faux.getModel(),
      getCredential: async () => 'fake-secret',
      stream: (model, context, options) => {
        providerInputs.push(JSON.stringify(context));
        return models.streamSimple(model, context, options);
      },
    });
    const modelCall = vi.spyOn(engine, 'run');
    const executor = new RunExecutor({
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
          ),
          createCompletePageRunTool(
            { projects, runs, runService, loadMaterials: loadProjectMaterials },
            { ...scope, maxSchemaBytes: 256 * 1024 },
          ),
        ]),
    });
    const service = new AgentService({
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
      desktopToken: 'fake-desktop-token',
      serviceInstanceId: 'test-instance',
      projects,
      projectService,
      projectApplyService,
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
      headers,
      payload: request,
    });
    expect(response.statusCode).toBe(202);
    const started = await start.mock.results[0]!.value;
    const result = await started.completion;
    expect(modelCall).toHaveBeenCalledWith(
      expect.objectContaining({ modelId: 'deepseek/deepseek-v4-pro' }),
    );
    expect(result, runs.get(started.run.id)?.errorMessage).toMatchObject({
      status: 'completed',
      resultWorkingVersion: expect.any(Number),
    });
    const edited = await getSchema(pageRef);
    expect(edited.revisionId).toBe(before.revisionId);
    expect(edited.schema.elements.element_root.props.padding).toEqual(expect.any(Number));
    expect(edited.schema.flows.flow_agent).toEqual(flow);
    expect(edited.schema.bindElements).toEqual([
      { id: 'button_agent', event: 'onClick', flowId: 'flow_agent' },
    ]);
    expect((await getWorkingSchemaState(pageRef)).workingVersion).toBe(
      request.baseWorkingVersion + 1,
    );
    const feedbackContext = JSON.parse(providerInputs.at(-1)!) as {
      messages: { role: string; isError?: boolean; content: { type: string; text?: string }[] }[];
    };
    const failure = feedbackContext.messages.find(
      (message) => message.role === 'toolResult' && message.isError,
    );
    const feedback = JSON.parse(failure!.content[0]!.text!);
    expect(feedback).toMatchObject({
      kind: 'page_run_validation',
      baseWorkingVersion: request.baseWorkingVersion,
      retryable: true,
      errors: [
        {
          code: 'INVALID_FLOW_REFERENCE',
          operationIndex: 2,
          path: '/flows/flow_agent/nodes/action/props/elementIds/0',
        },
      ],
    });
    expect(await readFile(target, 'utf8')).toBe(originalTarget);
    expect(runs.get(started.run.id)?.resultWorkingVersion).toBe(
      (await getWorkingSchemaState(pageRef)).workingVersion,
    );
    const revisions = join(project.path, '.origamix', 'revisions', page.id);
    expect(await readdir(revisions)).toHaveLength(1);

    const duplicate = await server.inject({
      method: 'POST',
      url: '/api/v1/agent/runs/create',
      headers,
      payload: request,
    });
    expect(duplicate.statusCode).toBe(202);
    expect(duplicate.json().data.runId).toBe(started.run.id);
    expect(modelCall).toHaveBeenCalledTimes(1);
    expect(await readdir(revisions)).toHaveLength(1);
    const stale = await server.inject({
      method: 'POST',
      url: '/api/v1/agent/runs/create',
      headers,
      payload: { ...request, clientRequestId: 'stale-edit' },
    });
    expect(stale.statusCode).toBe(409);
    expect(modelCall).toHaveBeenCalledTimes(1);
    const working = await getWorkingSchemaState(pageRef);
    const unsavedApply = await server.inject({
      method: 'POST',
      url: '/api/v1/pages/apply',
      headers,
      payload: {
        projectId: project.id,
        pageId: page.id,
        expectedRevisionId: edited.revisionId,
        expectedWorkingVersion: working.workingVersion,
        clientRequestId: 'unsaved-apply',
      },
    });
    expect(unsavedApply.statusCode).toBe(409);
    const saved = await saveWorkingRevision(pageRef, working.workingVersion);
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
    expect((await getSchema(pageRef)).revisionId).toBe(saved.revisionId);
    expect(await readdir(revisions)).toHaveLength(2);
  } finally {
    await server?.close();
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
