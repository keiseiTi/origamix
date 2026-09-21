import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it, vi } from 'vitest';
import { ApplicationDatabase } from '../../database/database';
import { ProjectRepository } from '../../projects/project-repository';
import { ProjectService } from '../../projects/project-service';
import { ProjectApplyService } from '../../schema/project-apply-service';
import { getSchema, getWorkingSchemaState, saveWorkingRevision } from '../../schema/schema-service';
import { AgentRunRepository } from '../../agent/run-repository';
import { AgentRunService } from '../../agent/run-service';
import { AgentService } from '../../agent/agent-service';
import { AgentEventBroker } from '../../agent/event-broker';
import { RunExecutor } from '../../agent/run-executor';
import { ScopeRouter } from '../../agent/scope-router';
import { ContextAssembler } from '../../agent/context-assembler';
import { ProductDocsProvider } from '../../agent/product-docs-provider';
import { ConversationRepository } from '../../conversations/conversation-repository';
import { ConversationService } from '../../conversations/conversation-service';
import { createDefaultAgentToolEntries } from '../../agent/tools/registry';
import { createApplyPageOperationsTool } from '../../agent/tools/apply-page-operations';
import { createDeterministicFakeAgentEngine } from '../../testing/deterministic-engine';
import { createHttpServer } from '../../http/server';

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
    const engine = createDeterministicFakeAgentEngine();
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
          createApplyPageOperationsTool(
            { projects, runs },
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
      router: new ScopeRouter(),
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
      'x-origamix-project-id': project.id,
    };
    const request = {
      version: '1',
      projectId: project.id,
      pageId: page.id,
      baseWorkingVersion: (await getWorkingSchemaState(pageRef)).workingVersion,
      clientRequestId: 'agent-edit',
      content: { version: '1', blocks: [{ type: 'text', text: '创建客户表单和表格' }] },
    };
    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/agent/runs',
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
    expect(await readFile(target, 'utf8')).toBe(originalTarget);
    expect(runs.get(started.run.id)?.resultWorkingVersion).toBe(
      (await getWorkingSchemaState(pageRef)).workingVersion,
    );
    const revisions = join(project.path, '.origamix', 'revisions', page.id);
    expect(await readdir(revisions)).toHaveLength(1);

    const duplicate = await server.inject({
      method: 'POST',
      url: '/api/v1/agent/runs',
      headers,
      payload: request,
    });
    expect(duplicate.statusCode).toBe(202);
    expect(duplicate.json().data.runId).toBe(started.run.id);
    expect(modelCall).toHaveBeenCalledTimes(1);
    expect(await readdir(revisions)).toHaveLength(1);
    const stale = await server.inject({
      method: 'POST',
      url: '/api/v1/agent/runs',
      headers,
      payload: { ...request, clientRequestId: 'stale-edit' },
    });
    expect(stale.statusCode).toBe(409);
    expect(modelCall).toHaveBeenCalledTimes(1);
    const working = await getWorkingSchemaState(pageRef);
    const unsavedApply = await server.inject({
      method: 'POST',
      url: `/api/v1/pages/${page.id}/apply`,
      headers,
      payload: {
        expectedRevisionId: edited.revisionId,
        expectedWorkingVersion: working.workingVersion,
        clientRequestId: 'unsaved-apply',
      },
    });
    expect(unsavedApply.statusCode).toBe(409);
    const saved = await saveWorkingRevision(pageRef, working.workingVersion);
    const foreign = await server.inject({
      method: 'POST',
      url: `/api/v1/pages/${page.id}/apply`,
      headers: { ...headers, 'x-origamix-project-id': 'project_other' },
      payload: {
        expectedRevisionId: saved.revisionId,
        expectedWorkingVersion: saved.workingVersion,
        clientRequestId: 'foreign-apply',
      },
    });
    expect(foreign.statusCode).toBe(404);
    expect(await readFile(target, 'utf8')).toBe(originalTarget);
    const applied = await server.inject({
      method: 'POST',
      url: `/api/v1/pages/${page.id}/apply`,
      headers,
      payload: {
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
