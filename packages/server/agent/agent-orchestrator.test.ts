import { Type } from '@sinclair/typebox';
import { describe, expect, it } from 'vitest';
import type { PageIntent } from '@origamix/shared/protocol/agent';
import { ApplicationDatabase } from '../database/database';
import { AgentRunRepository } from '../repositories/agent-run-repository';
import { ConversationRepository } from '../repositories/conversation-repository';
import { ProjectRepository } from '../repositories/project-repository';
import { AgentRunService } from '../services/agent-run-service';
import { ConversationService } from '../services/conversation-service';
import { AgentEngineError, FakeAgentEngine, type AgentEngineRequest } from './agent-engine';
import { AgentRunOrchestrator } from './agent-orchestrator';
import type { ContextAssembler } from './context-assembler';
import { ScopeRouter } from './scope-router';

const setup = (
  handler: (
    request: AgentEngineRequest,
    call: number,
  ) => Promise<{
    text: string;
    usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  }>,
) => {
  const database = new ApplicationDatabase(':memory:');
  const timestamp = new Date().toISOString();
  database.connection
    .prepare(
      'INSERT INTO projects (id, path, name, status, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run('project_test', '/tmp/project-test', 'Test', 0, timestamp, timestamp);
  database.connection
    .prepare(
      'INSERT INTO pages (id, project_id, slug, name, relative_path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run('page_test', 'project_test', 'home', 'Home', 'pages/home', 0, timestamp, timestamp);
  const projects = new ProjectRepository(database);
  const runs = new AgentRunRepository(database);
  const conversations = new ConversationService(
    database,
    projects,
    new ConversationRepository(database),
    runs,
  );
  let calls = 0;
  const engine = new FakeAgentEngine((request) => handler(request, ++calls));
  const context = {
    assemble: async (input: { intent: PageIntent }) => ({
      version: '1',
      currentRevisionId: 'revision_base',
      systemPolicy: 'policy',
      runMode: input.intent.mode,
      history: [],
      materialCatalog: '[]',
      schemaOutline: '{}',
      schemaFragment: '{}',
      productDocs: [],
      sizeChars: 10,
      truncated: { history: false, schema: false, docs: false, summary: false },
    }),
  } as unknown as ContextAssembler;
  const orchestrator = new AgentRunOrchestrator({
    projects,
    runs,
    conversations,
    runService: new AgentRunService(runs),
    router: new ScopeRouter(),
    context,
    engine,
    createTools: () => [
      {
        tool: {
          name: 'replace_page_schema',
          description: 'write',
          parameters: Type.Object({}),
          execute: async () => ({ revisionId: 'revision_result' }),
        },
        policy: {
          toolName: 'replace_page_schema',
          scope: 'page_write',
          risk: 'low',
          requiresConfirmation: false,
        },
      },
    ],
  });
  const input = (message: string, clientRequestId = message) => ({
    projectId: 'project_test',
    pageId: 'page_test',
    clientRequestId,
    baseRevisionId: 'revision_base',
    message,
  });
  return { database, runs, orchestrator, input, calls: () => calls };
};

const usage = { inputTokens: 2, outputTokens: 3, totalTokens: 5 };

describe('AgentRunOrchestrator', () => {
  it('settles out-of-scope and clarification modes without invoking the engine', async () => {
    const fixture = setup(async () => ({ text: 'unexpected', usage }));
    const weather = await fixture.orchestrator.run(fixture.input('今天天气怎么样'));
    const unclear = await fixture.orchestrator.run(fixture.input('加一个天气'));
    expect(weather).toMatchObject({ mode: 'out_of_scope', status: 'completed' });
    expect(unclear).toMatchObject({ mode: 'clarification_required', status: 'completed' });
    expect(fixture.calls()).toBe(0);
    fixture.database.close();
  });

  it('answers page questions without exposing a write tool', async () => {
    const fixture = setup(async (request) => {
      expect(request.tools).toEqual([]);
      await request.onEvent?.({ type: 'text_delta', delta: '使用表单物料。' });
      return { text: '使用表单物料。', usage };
    });
    const result = await fixture.orchestrator.run(fixture.input('表单如何搭建'));
    expect(result).toMatchObject({
      mode: 'page_question',
      status: 'completed',
      text: '使用表单物料。',
    });
    fixture.database.close();
  });

  it('keeps assistant text and a successful Schema commit as separate outcomes', async () => {
    const fixture = setup(async (request) => {
      const tool = request.tools?.find(({ name }) => name === 'replace_page_schema');
      if (!tool) throw new Error('replace_page_schema tool missing');
      await request.onEvent?.({
        type: 'tool_start',
        toolCallId: 'call_1',
        toolName: tool.name,
        input: {},
      });
      const result = await tool.execute({}, request.signal!);
      await request.onEvent?.({
        type: 'tool_end',
        toolCallId: 'call_1',
        toolName: tool.name,
        result,
        isError: false,
      });
      await request.onEvent?.({ type: 'text_delta', delta: '已提交。' });
      return { text: '已提交。', usage };
    });
    const result = await fixture.orchestrator.run(fixture.input('创建一个表单页面'));
    expect(result).toMatchObject({
      status: 'completed',
      text: '已提交。',
      resultRevisionId: 'revision_result',
    });
    expect(fixture.runs.get(result.runId)).toMatchObject({
      status: 'completed',
      resultRevisionId: 'revision_result',
      modelCalls: 1,
      toolCalls: 1,
      inputTokens: 2,
      outputTokens: 3,
    });
    fixture.database.close();
  });

  it('allows one repair and fails safely when the model or repair fails', async () => {
    const repaired = setup(async (request, call) => {
      if (call === 2) {
        const tool = request.tools![0]!;
        await request.onEvent?.({
          type: 'tool_start',
          toolCallId: 'call_2',
          toolName: tool.name,
          input: {},
        });
        const result = await tool.execute({}, request.signal!);
        await request.onEvent?.({
          type: 'tool_end',
          toolCallId: 'call_2',
          toolName: tool.name,
          result,
          isError: false,
        });
      }
      return { text: '', usage };
    });
    await expect(
      repaired.orchestrator.run(repaired.input('创建一个表单页面')),
    ).resolves.toMatchObject({
      status: 'completed',
      resultRevisionId: 'revision_result',
    });
    expect(repaired.calls()).toBe(2);
    repaired.database.close();

    const failed = setup(async () => {
      throw new AgentEngineError('PROVIDER_ERROR', '模型服务调用失败');
    });
    await expect(failed.orchestrator.run(failed.input('表单如何搭建'))).resolves.toMatchObject({
      status: 'failed',
    });
    failed.database.close();
  });

  it('cancels an active run and releases it', async () => {
    let notifyStarted!: () => void;
    const engineStarted = new Promise<void>((resolve) => {
      notifyStarted = resolve;
    });
    const fixture = setup(async (request) => {
      notifyStarted();
      await new Promise<void>((resolve) => {
        request.signal?.addEventListener('abort', () => resolve(), { once: true });
      });
      throw new AgentEngineError('CANCELLED', 'cancelled');
    });
    const pending = fixture.orchestrator.run(fixture.input('表单如何搭建'));
    await engineStarted;
    const runId = fixture.runs.listActive()[0]!.id;
    fixture.orchestrator.cancel(runId);
    await expect(pending).resolves.toMatchObject({ status: 'cancelled' });
    expect(fixture.runs.get(runId)?.status).toBe('cancelled');
    fixture.database.close();
  });
});
