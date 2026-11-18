import assert from 'node:assert/strict';
import type {
  AgentDailyUsage,
  AgentPageUsage,
  AgentRun,
  CreateAgentRunRequest,
  SchemaOperation,
} from '@origamix/shared';
import type { AgentEngine } from '../src/agent/agent-engine';
import { MysqlAgentRunRepository } from '../src/agent/mysql-agent-repository';
import { resolveAgentRunBudget } from '../src/agent/run-budget';
import { AgentRunService } from '../src/agent/run-service';
import { hashOperations } from '../src/agent/tools/operation-digest';
import { MysqlConversationService } from '../src/conversations/mysql-conversation-service';
import { openWebDatabase } from '../src/database/mysql-web';
import { startMysqlWebServer } from '../src/hosts/mysql-web-server';
import { MysqlProjectService } from '../src/projects/mysql-project-service';
import { applyWorkingSchemaOperations } from '../src/schema/schema-service';

const mysqlUrl = process.env.ORIGAMIX_TEST_MYSQL_URL;
if (!mysqlUrl) throw new Error('Set ORIGAMIX_TEST_MYSQL_URL to a disposable database');
const headers = {
  Authorization: 'Bearer mysql-agent-test-token',
  'X-Origamix-Service': 'mysql-agent-test-instance',
  'Content-Type': 'application/json',
};
const startInput = {
  mysqlUrl,
  desktopToken: 'mysql-agent-test-token',
  serviceInstanceId: 'mysql-agent-test-instance',
};
const operation = (height: number): SchemaOperation => ({
  operation: 'updateElementProps',
  elementId: 'element_root',
  set: { height },
});
let calls = 0;
const latch = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const entered = latch();
const proceed = latch();
const engine: AgentEngine = {
  run: async (request) => {
    calls++;
    if (calls === 1) {
      entered.resolve();
      await proceed.promise;
    }
    const usage = { inputTokens: 2, outputTokens: 3, totalTokens: 5 };
    request.budget?.beforeRequest(2, 128_000, 16_000);
    await request.onEvent?.({
      type: 'model_usage',
      metrics: {
        estimatedInputTokens: 5,
        inputBytes: 0,
        systemBytes: 0,
        toolDefinitionBytes: 0,
        userBytes: 0,
        assistantBytes: 0,
        toolResultBytes: 0,
        inputTokens: 2,
        outputTokens: 3,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        inputUsageEstimated: false,
        outputUsageEstimated: false,
        durationMs: 0,
        toolCalls: 1,
        repeatedToolCalls: 0,
      },
    });
    request.budget?.recordUsage(usage);
    const tool = request.tools?.find(({ name }) => name === 'complete_page_run');
    assert.ok(tool);
    const input = { outcome: 'apply_changes', operations: [operation(64)], response: '已修改页面' };
    const event = { toolCallId: 'test-terminal', toolName: tool.name };
    await request.onEvent?.({ type: 'tool_start', ...event, input });
    try {
      const result = await tool.execute(input, request.signal ?? new AbortController().signal);
      await request.onEvent?.({ type: 'tool_end', ...event, result, isError: false });
    } catch (result) {
      await request.onEvent?.({ type: 'tool_end', ...event, result, isError: true });
    }
    return {
      text: '',
      budgetTracked: true,
      usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
    };
  },
};

type Working = {
  workingVersion: number;
  workingHash: string;
  revisionId: string;
  schema: {
    elements: { element_root: { props: { height?: number } } };
  };
};
let host: Awaited<ReturnType<typeof startMysqlWebServer>> | undefined;
let seedPool: Awaited<ReturnType<typeof openWebDatabase>> | undefined;
let projectId: string | undefined;

const post = async <T>(pathname: string, body: object, status = 200): Promise<T> => {
  const response = await fetch(`http://127.0.0.1:${host!.port}/api/v1${pathname}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  return result.data as T;
};

const events = async (runId: string) => {
  const response = await fetch(
    `http://127.0.0.1:${host!.port}/api/v1/projects/${projectId}/agent/runs/${runId}/events`,
    {
      headers,
      signal: AbortSignal.timeout(8000),
    },
  );
  assert.equal(response.status, 200);
  return response.text();
};

try {
  host = await startMysqlWebServer({ ...startInput, agentEngine: engine });
  const project = await post<{ id: string }>(
    '/projects/create',
    {
      name: 'MySQL Agent test',
      code: `agent-test-${Date.now()}`,
      pageDirectory: 'pages',
    },
    201,
  );
  projectId = project.id;
  const page = await post<{ id: string }>(
    '/pages/create',
    { projectId, name: 'Home', slug: 'home' },
    201,
  );
  const scope = { projectId, pageId: page.id };
  const working = () => post<Working>('/pages/working-state/get', scope);
  const draft = await working();
  const request = (clientRequestId: string, baseWorkingVersion: number): CreateAgentRunRequest => ({
    version: '1',
    ...scope,
    clientRequestId,
    baseWorkingVersion,
    content: { version: '1', blocks: [{ type: 'text', text: '修改容器高度' }] },
  });

  const stale = await post<{ runId: string }>(
    '/agent/runs/create',
    request('canvas-wins', draft.workingVersion),
    202,
  );
  await Promise.race([
    entered.promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Agent did not reach the model')), 5000).unref(),
    ),
  ]);
  const canvas = await post<Working>('/pages/working-operations/apply', {
    ...scope,
    baseWorkingVersion: draft.workingVersion,
    operations: [operation(48)],
  });
  proceed.resolve();
  assert.match(await events(stale.runId), /WORKING_VERSION_CONFLICT/);
  assert.equal((await working()).workingHash, canvas.workingHash);
  await post('/agent/runs/create', request('stale-admission', draft.workingVersion), 409);

  const submission = request('agent-wins', canvas.workingVersion);
  const completed = await post<{ runId: string; conversationId: string }>(
    '/agent/runs/create',
    submission,
    202,
  );
  assert.match(await events(completed.runId), /event: run\.completed/);
  const applied = await working();
  assert.equal(applied.workingVersion, canvas.workingVersion + 1);
  assert.equal(applied.revisionId, draft.revisionId);
  assert.equal(applied.schema.elements.element_root.props.height, 64);
  await post(
    '/pages/working-operations/apply',
    {
      ...scope,
      baseWorkingVersion: canvas.workingVersion,
      operations: [operation(72)],
    },
    409,
  );
  const duplicate = await post<{ runId: string }>('/agent/runs/create', submission, 202);
  assert.equal(duplicate.runId, completed.runId);
  assert.equal(calls, 2);

  // Seed the exact loss-of-process window: the MySQL transaction has committed Working + receipt,
  // while the Run has not yet recorded its result. No model or tool runs during recovery.
  seedPool = await openWebDatabase(mysqlUrl);
  const projects = new MysqlProjectService(seedPool);
  const runs = new MysqlAgentRunRepository(seedPool);
  const conversations = new MysqlConversationService(seedPool, projects, runs);
  const runService = new AgentRunService(runs);
  const admission = {
    modelRef: 'deepseek-flash',
    runKind: 'page_assistant' as const,
    budget: resolveAgentRunBudget(),
    promptVersion: '2',
    policyVersion: '1',
    toolsetVersion: '2',
    materialManifestVersion: 'official-antd@1.0.0',
  };
  const interrupted = await conversations.startRun({
    ...request('commit-before-crash', applied.workingVersion),
    ...admission,
  });
  const runId = interrupted.run.id;
  await runService.transition(runId, 'preparing');
  await runService.transition(runId, 'reasoning');
  const operations = [operation(96)];
  const operationDigest = hashOperations(operations);
  await runService.transition(runId, 'deciding', {
    operationCount: 1,
    operationDigest,
    outcomeJson: { outcome: 'apply_changes', operations, response: '已保留提交' },
  });
  await runService.transition(runId, 'validating');
  const commit = await applyWorkingSchemaOperations(
    projects.resolveSchemaPage(projectId, page.id),
    {
      baseWorkingVersion: applied.workingVersion,
      operations,
    },
    { agentCommit: { runId, projectId, operationDigest } },
  );
  const newer = await post<Working>('/pages/working-operations/apply', {
    ...scope,
    baseWorkingVersion: commit.workingVersion,
    operations: [operation(128)],
  });
  const otherPage = await post<{ id: string }>(
    '/pages/create',
    { projectId, name: 'Queued', slug: 'queued' },
    201,
  );
  const other = await post<Working>('/pages/working-state/get', {
    projectId,
    pageId: otherPage.id,
  });
  const uncommitted = await conversations.startRun({
    ...request('queued-before-crash', other.workingVersion),
    pageId: otherPage.id,
    ...admission,
  });

  await host.close();
  host = undefined;
  host = await startMysqlWebServer({ ...startInput, agentEngine: engine });
  const recovered = await post<{ run: AgentRun }>('/agent/runs/get', { projectId, runId });
  assert.equal(recovered.run.status, 'completed');
  assert.equal(recovered.run.resultWorkingVersion, commit.workingVersion);
  assert.equal(recovered.run.resultWorkingHash, commit.workingHash);
  assert.equal((await working()).workingHash, newer.workingHash);
  // A failed model call still used tokens, while the duplicate submission and
  // startup recovery do not generate any additional provider usage.
  const usage = await post<AgentPageUsage>('/agent/usage/page', {
    ...scope,
    timeZone: 'Asia/Shanghai',
  });
  assert.deepEqual(usage.total, { inputTokens: 4, outputTokens: 6, incompleteRuns: 0 });
  const daily = await post<AgentDailyUsage>('/agent/usage/daily', {
    days: 7,
    scope,
    timeZone: 'Asia/Shanghai',
  });
  assert.equal(daily.days.length, 7);
  assert.deepEqual(daily.today, usage.today);
  assert.deepEqual(daily.projects[0]?.pages[0], {
    ...scope,
    name: 'Home',
    ...usage.total,
  });
  const unsettled = await post<{ run: AgentRun }>('/agent/runs/get', {
    projectId,
    runId: uncommitted.run.id,
  });
  assert.equal(unsettled.run.status, 'interrupted');
  const history = await post<{ messages: { runId: string; role: string }[] }>(
    '/agent/messages/list',
    {
      ...scope,
      conversationId: interrupted.conversation.id,
    },
  );
  assert.equal(
    history.messages.filter((message) => message.role === 'assistant' && message.runId === runId)
      .length,
    1,
  );
  assert.equal(calls, 2);
  console.info(
    'MySQL Agent integration passed: stale-write rejection, durable conversation, receipt recovery and no replay.',
  );
} finally {
  proceed.resolve();
  try {
    if (host && projectId) await post('/projects/delete', { projectId, scope: 'desktop_record' });
  } finally {
    await host?.close();
    await seedPool?.end();
  }
}
