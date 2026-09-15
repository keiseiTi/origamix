import { deferred } from '../testing/deferred';
import { FakeAgentEngine } from '../testing/fake-agent-engine';
import { Type } from '@sinclair/typebox';
import { describe, expect, it, vi } from 'vitest';
import type { PageIntent } from '@origamix/shared/protocol/agent';
import { ApplicationDatabase } from '../database/database';
import { AgentRunRepository } from './run-repository';
import { ConversationRepository } from '../conversations/conversation-repository';
import { ProjectRepository } from '../projects/project-repository';
import { AgentRunService } from './run-service';
import { ConversationService } from '../conversations/conversation-service';
import { AgentEngineError, type AgentEngineRequest } from './engine';
import { RunExecutor } from './run-executor';
import { AgentService } from './agent-service';
import { AgentEventBroker } from './event-broker';
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
  const runService = new AgentRunService(runs);
  const executor = new RunExecutor({
    projects,
    runs,
    conversations,
    runService,
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
  const events = new AgentEventBroker();
  const router = new ScopeRouter();
  const getCurrentRevision = vi.fn(async () => 'revision_base');
  const service = new AgentService({
    conversations,
    runs,
    runService,
    executor,
    events,
    router,
    getCurrentRevision,
  });
  const input = (message: string, clientRequestId = message) => ({
    version: '1' as const,
    projectId: 'project_test',
    pageId: 'page_test',
    clientRequestId,
    baseRevisionId: 'revision_base',
    content: { version: '1' as const, blocks: [{ type: 'text' as const, text: message }] },
  });
  const run = async (request: ReturnType<typeof input>) =>
    (await service.start(request)).completion!;
  return {
    database,
    runs,
    conversations,
    executor,
    router,
    events,
    getCurrentRevision,
    service,
    run,
    input,
    calls: () => calls,
  };
};

const usage = { inputTokens: 2, outputTokens: 3, totalTokens: 5 };

describe('Agent execution through AgentService', () => {
  it('settles out-of-scope and clarification modes without invoking the engine', async () => {
    const fixture = setup(async () => ({ text: 'unexpected', usage }));
    const weather = await fixture.run(fixture.input('今天天气怎么样'));
    const unclear = await fixture.run(fixture.input('加一个天气'));
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
    const result = await fixture.run(fixture.input('表单如何搭建'));
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
    const result = await fixture.run(fixture.input('创建一个表单页面'));
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
    await expect(repaired.run(repaired.input('创建一个表单页面'))).resolves.toMatchObject({
      status: 'completed',
      resultRevisionId: 'revision_result',
    });
    expect(repaired.calls()).toBe(2);
    repaired.database.close();

    const failed = setup(async () => {
      throw new AgentEngineError('PROVIDER_ERROR', '模型服务调用失败');
    });
    await expect(failed.run(failed.input('表单如何搭建'))).resolves.toMatchObject({
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
    const pending = fixture.run(fixture.input('表单如何搭建'));
    await engineStarted;
    const runId = fixture.runs.listActive()[0]!.id;
    fixture.service.cancel(runId, 'cancel-request');
    await expect(pending).resolves.toMatchObject({ status: 'cancelled' });
    expect(fixture.runs.get(runId)?.status).toBe('cancelled');
    fixture.database.close();
  });
});

describe('Agent startup ownership', () => {
  it('deduplicates concurrent requests before routing and shares one execution', async () => {
    const release = deferred();
    const fixture = setup(async () => {
      await release.promise;
      return { text: 'answer', usage };
    });
    const route = vi.spyOn(fixture.router, 'route');
    const request = fixture.input('表单如何搭建', 'same-request');
    try {
      const [first, second] = await Promise.all([
        fixture.service.start(request),
        fixture.service.start(request),
      ]);
      expect(first.run.id).toBe(second.run.id);
      expect(first.completion).toBe(second.completion);
      expect(first.completion).toBeDefined();
      expect(route).toHaveBeenCalledTimes(1);
      expect(fixture.getCurrentRevision).toHaveBeenCalledTimes(1);
      release.resolve();
      await first.completion;
      expect(fixture.calls()).toBe(1);
      const replay = await fixture.service.start(request);
      expect(replay.run.status).toBe('completed');
      expect(replay.completion).toBeUndefined();
      expect(route).toHaveBeenCalledTimes(1);
      const subscription = fixture.events.subscribe(first.run.id, -1, () => {});
      expect(subscription.replay.map((event) => event.type)).toEqual([
        'run.queued',
        'run.completed',
      ]);
      subscription.close();
      await expect(
        fixture.service.start({
          ...request,
          content: { version: '1', blocks: [{ type: 'text', text: 'changed' }] },
        }),
      ).rejects.toThrow();
      expect(fixture.calls()).toBe(1);
    } finally {
      release.resolve();
      fixture.database.close();
    }
  });

  it('rejects stale and cross-project requests without creating a run, then accepts a valid retry', async () => {
    const fixture = setup(async () => ({ text: 'ok', usage }));
    try {
      const request = fixture.input('表单如何搭建');
      await expect(fixture.service.start({ ...request, baseRevisionId: 'old' })).rejects.toThrow(
        '页面版本已变化',
      );
      await expect(
        fixture.service.start({ ...request, projectId: 'missing-project' }),
      ).rejects.toThrow('项目不存在');
      expect(fixture.runs.listActive()).toEqual([]);
      expect(fixture.calls()).toBe(0);
      expect(await fixture.run(request)).toMatchObject({ status: 'completed' });
    } finally {
      fixture.database.close();
    }
  });

  it('settles durable failure and events when execution setup unexpectedly rejects', async () => {
    const fixture = setup(async () => ({ text: 'unexpected', usage }));
    vi.spyOn(fixture.executor, 'execute').mockRejectedValueOnce(new Error('setup failed'));
    try {
      const started = await fixture.service.start(fixture.input('表单如何搭建'));
      expect(await started.completion).toMatchObject({ status: 'failed' });
      expect(fixture.runs.get(started.run.id)).toMatchObject({
        status: 'failed',
        errorCode: 'INTERNAL_ERROR',
      });
      const history = fixture.conversations.history(
        'project_test',
        'page_test',
        started.conversationId,
      );
      expect(history.find((message) => message.role === 'assistant')).toMatchObject({
        status: 'failed',
      });
      expect(fixture.events.isTerminal(started.run.id)).toBe(true);
      expect(fixture.calls()).toBe(0);
      const retry = {
        ...fixture.input('表单如何搭建', 'retry'),
        conversationId: started.conversationId,
        retryOfRunId: started.run.id,
      };
      expect(await fixture.run(retry)).toMatchObject({ status: 'completed' });
    } finally {
      fixture.database.close();
    }
  });

  it('cancels a queued run before the engine executes', async () => {
    const fixture = setup(async () => ({ text: 'unexpected', usage }));
    const execute = fixture.executor.execute.bind(fixture.executor);
    vi.spyOn(fixture.executor, 'execute').mockImplementationOnce(async (...args) => {
      fixture.service.cancel(args[0].run.id, 'cancel-queued');
      return execute(...args);
    });
    try {
      const started = await fixture.service.start(fixture.input('表单如何搭建'));
      expect(await started.completion).toMatchObject({ status: 'cancelled' });
      expect(fixture.runs.get(started.run.id)?.status).toBe('cancelled');
      expect(fixture.calls()).toBe(0);
      expect(fixture.events.isTerminal(started.run.id)).toBe(true);
    } finally {
      fixture.database.close();
    }
  });
});
