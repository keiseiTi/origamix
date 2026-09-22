import { deferred } from '../../testing/deferred';
import { FakeAgentEngine } from '../../testing/fake-agent-engine';
import { Type } from '@sinclair/typebox';
import { describe, expect, it, vi } from 'vitest';
import { ApplicationDatabase } from '../../database/database';
import { AgentRunRepository } from '../../agent/run-repository';
import { ConversationRepository } from '../../conversations/conversation-repository';
import { ProjectRepository } from '../../projects/project-repository';
import { AgentRunService } from '../../agent/run-service';
import { ConversationService } from '../../conversations/conversation-service';
import { AgentEngineError, type AgentEngineRequest } from '../../agent/engine';
import { RunExecutor } from '../../agent/run-executor';
import { AgentService } from '../../agent/agent-service';
import { AgentEventBroker } from '../../agent/event-broker';
import type { ContextAssembler } from '../../agent/context-assembler';

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
  const engine = new FakeAgentEngine(async (request) => handler(request, ++calls));
  const context = {
    assemble: async (input: { currentRequest: string }) => ({
      version: '1',
      currentRevisionId: 'revision_base',
      systemPolicy: 'policy',
      currentRequest: input.currentRequest,
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
          name: 'complete_page_run',
          description: 'terminal',
          parameters: Type.Object({}),
          execute: async (raw) => {
            const input = raw as { outcome?: string; response?: string };
            const run = runs.listActive()[0]!;
            runService.transition(run.id, 'deciding', {
              outcome: input.outcome === 'apply_changes' ? 'changed' : 'answered_only',
              outcomeJson: raw,
            });
            if (input.outcome === 'apply_changes') {
              runService.transition(run.id, 'validating');
              if (input.response === 'invalid') {
                runService.transition(run.id, 'repairing', {
                  repairAttempts: run.repairAttempts + 1,
                });
                throw new Error('第 19 个 Operation 的 size 属性无效');
              }
              runService.recordWorkingCommit(run.id, 2, 'hash_result');
              runService.transition(run.id, 'committing');
            }
            return {
              accepted: true,
              outcome: input.outcome === 'apply_changes' ? 'changed' : 'answered_only',
              response: input.response ?? '已完成。',
              ...(input.outcome === 'apply_changes' ? { resultWorkingVersion: 2 } : {}),
            };
          },
        },
        policy: {
          toolName: 'complete_page_run',
          scope: 'page_write',
          risk: 'low',
          requiresConfirmation: false,
        },
      },
    ],
  });
  const events = new AgentEventBroker();
  const getCurrentState = vi.fn(async () => ({
    workingVersion: 1,
    schema: {
      elements: {
        element_root: { type: 'container', props: {} },
        button_target: { type: 'button', props: { children: '提交' } },
      },
      layout: {
        root: 'element_root',
        structure: { element_root: ['button_target'], button_target: [] },
      },
      flows: {},
      bindElements: [],
      context: { globalVariables: [] },
      extensions: { origamix: { schemaVersion: '1.0' as const } },
    },
  }));
  const service = new AgentService({
    conversations,
    runService,
    runs,
    executor,
    events,
    getCurrentState,
  });
  const input = (message: string, clientRequestId = message) => ({
    version: '1' as const,
    projectId: 'project_test',
    pageId: 'page_test',
    clientRequestId,
    baseWorkingVersion: 1,
    content: { version: '1' as const, blocks: [{ type: 'text' as const, text: message }] },
  });
  const run = async (request: ReturnType<typeof input>) =>
    (await service.start(request)).completion!;
  return {
    database,
    runs,
    conversations,
    runService,
    executor,
    events,
    getCurrentState,
    service,
    run,
    input,
    calls: () => calls,
  };
};

const usage = { inputTokens: 2, outputTokens: 3, totalTokens: 5 };

const complete = async (
  request: AgentEngineRequest,
  input: { outcome: 'answer_only' | 'apply_changes'; response: string },
) => {
  const tool = request.tools?.find(({ name }) => name === 'complete_page_run');
  if (!tool) throw new Error('complete_page_run tool missing');
  await request.onEvent?.({
    type: 'tool_start',
    toolCallId: 'call_terminal',
    toolName: tool.name,
    input,
  });
  const result = await tool.execute(input, request.signal!);
  await request.onEvent?.({
    type: 'tool_end',
    toolCallId: 'call_terminal',
    toolName: tool.name,
    result,
    isError: false,
  });
};

describe('Agent execution through AgentService', () => {
  it('gives every routed request the same terminal capability', async () => {
    const fixture = setup(async (request) => {
      expect(request.tools?.map(({ name }) => name)).toEqual(['complete_page_run']);
      await complete(request, { outcome: 'answer_only', response: '使用表单物料。' });
      return { text: '使用表单物料。', usage };
    });
    await expect(fixture.run(fixture.input('今天天气怎么样'))).resolves.toMatchObject({
      status: 'completed',
      outcome: 'answered_only',
      text: '使用表单物料。',
    });
    await expect(fixture.run(fixture.input('表单如何搭建'))).resolves.toMatchObject({
      status: 'completed',
      outcome: 'answered_only',
      text: '使用表单物料。',
    });
    expect(fixture.calls()).toBe(2);
    fixture.database.close();
  });

  it('keeps assistant text and a successful Schema commit as separate outcomes', async () => {
    const fixture = setup(async (request) => {
      await complete(request, { outcome: 'apply_changes', response: '已提交。' });
      return { text: '已提交。', usage };
    });
    const result = await fixture.run(fixture.input('创建一个表单页面'));
    expect(result).toMatchObject({
      status: 'completed',
      text: '已提交。',
      resultWorkingVersion: 2,
    });
    expect(fixture.runs.get(result.runId)).toMatchObject({
      status: 'completed',
      resultWorkingVersion: 2,
      modelCalls: 1,
      toolCalls: 1,
      inputTokens: 2,
      outputTokens: 3,
    });
    fixture.database.close();
  });

  it('fails safely when the model omits the terminal decision', async () => {
    const rejected = setup(async (request) => {
      expect(request.tools?.map(({ name }) => name)).toEqual(['complete_page_run']);
      return { text: '', usage };
    });
    const rejectedResult = await rejected.run(rejected.input('添加默认表格'));
    expect(rejectedResult).toMatchObject({ status: 'failed' });
    const rejectedRun = rejected.runs.get(rejectedResult.runId)!;
    expect(rejectedRun.errorMessage).toBe('模型在协议修复后仍未提交 complete_page_run');
    expect(
      rejected.conversations
        .history(rejectedRun.projectId, rejectedRun.pageId, rejectedRun.conversationId)
        .find(({ role }) => role === 'assistant')?.content.blocks,
    ).toEqual([
      {
        type: 'text',
        text: '本次请求未完成：模型在协议修复后仍未提交 complete_page_run',
      },
    ]);
    rejected.database.close();

    const failed = setup(async () => {
      throw new AgentEngineError('PROVIDER_ERROR', '模型服务调用失败');
    });
    await expect(failed.run(failed.input('表单如何搭建'))).resolves.toMatchObject({
      status: 'failed',
    });
    failed.database.close();
  });

  it('repairs one rejected complete Operation List against the original baseline', async () => {
    const fixture = setup(async (request, call) => {
      const tool = request.tools!.find(({ name }) => name === 'complete_page_run')!;
      if (call === 1) {
        await request.onEvent?.({
          type: 'tool_start',
          toolCallId: 'invalid',
          toolName: tool.name,
          input: {},
        });
        let error: unknown;
        try {
          await tool.execute({ outcome: 'apply_changes', response: 'invalid' }, request.signal!);
        } catch (caught) {
          error = caught;
        }
        await request.onEvent?.({
          type: 'tool_end',
          toolCallId: 'invalid',
          toolName: tool.name,
          result: { message: error instanceof Error ? error.message : 'invalid' },
          isError: true,
        });
      } else {
        expect(request.prompt).toContain('第 19 个 Operation');
        expect(request.prompt).toContain('原始 base Working Version');
        await complete(request, { outcome: 'apply_changes', response: '修复后已提交。' });
      }
      return { text: '', usage };
    });
    await expect(fixture.run(fixture.input('修改二十个节点'))).resolves.toMatchObject({
      status: 'completed',
      outcome: 'changed',
      resultWorkingVersion: 2,
      text: '修复后已提交。',
    });
    expect(fixture.calls()).toBe(2);
    fixture.database.close();
  });

  it('keeps a committed Working update successful when the model fails afterward', async () => {
    const fixture = setup(async (request) => {
      await complete(request, { outcome: 'apply_changes', response: '页面已修改。' });
      throw new AgentEngineError('PROVIDER_ERROR', 'terminal transport failed');
    });
    const result = await fixture.run(fixture.input('修改页面'));
    expect(result).toMatchObject({
      status: 'completed',
      text: '页面已修改。',
      resultWorkingVersion: 2,
    });
    expect(fixture.runs.get(result.runId)).toMatchObject({
      status: 'completed',
      outcome: 'changed',
      resultWorkingVersion: 2,
    });
    fixture.database.close();
  });

  it('converges to success when cancellation races after the Working commit point', async () => {
    const fixture = setup(async (request) => {
      await complete(request, { outcome: 'apply_changes', response: '页面已提交。' });
      const active = fixture.runs.listActive()[0]!;
      expect(fixture.service.cancel(active.id, 'cancel-after-commit').status).toBe('committing');
      return { text: '', usage };
    });
    const result = await fixture.run(fixture.input('修改并尝试取消'));
    expect(result).toMatchObject({
      status: 'completed',
      resultWorkingVersion: 2,
      text: '页面已提交。',
    });
    expect(fixture.runs.get(result.runId)?.status).toBe('completed');
    fixture.database.close();
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
  it('accepts only a current clarification candidate from the same page and conversation', async () => {
    const fixture = setup(async (request) => {
      await complete(request, { outcome: 'answer_only', response: 'ok' });
      return { text: 'ok', usage };
    });
    try {
      const source = fixture.conversations.startRun({
        ...fixture.input('请选择目标', 'clarification-source'),
        modelRef: 'fake',
        runKind: 'page_assistant',
        budget: {
          maxModelCalls: 1,
          maxToolCalls: 1,
          maxOutputTokens: 100,
          maxDurationMs: 1_000,
          maxSchemaBytes: 1_000,
          maxRepairAttempts: 0,
        },
        promptVersion: '1',
        policyVersion: '1',
        toolsetVersion: '1',
        materialManifestVersion: '1',
      });
      fixture.runService.transition(source.run.id, 'preparing');
      fixture.runService.transition(source.run.id, 'reasoning');
      fixture.runService.transition(source.run.id, 'deciding', {
        outcome: 'needs_clarification',
        outcomeJson: {
          clarificationId: 'clarification_one',
          baseWorkingVersion: 1,
          question: '选择按钮',
          candidates: [{ elementId: 'button_target', label: '提交按钮' }],
        },
      });
      fixture.runService.transition(source.run.id, 'completed');
      const followUp = {
        ...fixture.input('选择提交按钮', 'clarification-follow-up'),
        conversationId: source.conversation.id,
        clarification: {
          runId: source.run.id,
          clarificationId: 'clarification_one',
          selectedElementId: 'button_target',
        },
      };
      await expect(fixture.run(followUp)).resolves.toMatchObject({ status: 'completed' });
      await expect(
        fixture.service.start({
          ...followUp,
          clientRequestId: 'clarification-invalid',
          clarification: { ...followUp.clarification, selectedElementId: 'button_other' },
        }),
      ).rejects.toThrow('澄清选项已过期或不属于当前页面');
    } finally {
      fixture.database.close();
    }
  });

  it('deduplicates concurrent requests before routing and shares one execution', async () => {
    const release = deferred();
    const fixture = setup(async (request) => {
      await release.promise;
      await complete(request, { outcome: 'answer_only', response: 'answer' });
      return { text: 'answer', usage };
    });
    const request = fixture.input('表单如何搭建', 'same-request');
    try {
      const [first, second] = await Promise.all([
        fixture.service.start(request),
        fixture.service.start(request),
      ]);
      expect(first.run.id).toBe(second.run.id);
      expect(first.completion).toBe(second.completion);
      expect(first.completion).toBeDefined();
      expect(fixture.getCurrentState).toHaveBeenCalledTimes(1);
      release.resolve();
      await first.completion;
      expect(fixture.calls()).toBe(1);
      const replay = await fixture.service.start(request);
      expect(replay.run.status).toBe('completed');
      expect(replay.completion).toBeUndefined();
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
    const fixture = setup(async (request) => {
      await complete(request, { outcome: 'answer_only', response: 'ok' });
      return { text: 'ok', usage };
    });
    try {
      const request = fixture.input('表单如何搭建');
      await expect(fixture.service.start({ ...request, baseWorkingVersion: 2 })).rejects.toThrow(
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
    const fixture = setup(async (request) => {
      await complete(request, { outcome: 'answer_only', response: 'ok' });
      return { text: 'ok', usage };
    });
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
