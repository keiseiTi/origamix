import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startServer } from '../src/server';
import { ProjectService } from '../src/projects/project-service';
import { PiAgentEngine } from '../src/agent/pi-agent-engine';
import { AgentEngineError } from '../src/agent/agent-engine';

const http = vi.hoisted(() => ({
  server: undefined as import('fastify').FastifyInstance | undefined,
  subscribers: (): number => 0,
}));
// Replace only OS listening; lifecycle hooks, HTTP handlers, Agent and SQLite are real.
vi.mock('../src/http/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/http/server')>();
  return {
    createHttpServer: (...args: Parameters<typeof actual.createHttpServer>) => {
      const server = actual.createHttpServer(...args);
      vi.spyOn(server, 'listen').mockResolvedValue(undefined);
      vi.spyOn(server.server, 'address').mockReturnValue({
        address: '127.0.0.1',
        family: 'IPv4',
        port: 1234,
      });
      http.server = server;
      http.subscribers = () => args[0].agent?.events.resourceSnapshot().subscribers ?? 0;
      return server;
    },
  };
});
import { ApplicationDatabase } from '../src/database/database';
import { AgentRunRepository } from '../src/agent/run-repository';
import { ConversationRepository } from '../src/conversations/conversation-repository';
import { ProjectRepository } from '../src/projects/project-repository';
import { ConversationService } from '../src/conversations/conversation-service';
import { recoverAgentRunsOnStartup } from '../src/agent/run-recovery';

const directories: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('server startup Agent recovery', () => {
  it('closes a live Agent and SSE before SQLite and retains the terminal Run on reopen', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-close-agent-'));
    directories.push(directory);
    const path = join(directory, 'application.db');
    const templatePath = fileURLToPath(new URL('../../template', import.meta.url));
    const seed = new ApplicationDatabase(path);
    const service = new ProjectService(new ProjectRepository(seed), templatePath);
    service.registerGrant('grant_close', directory);
    const project = await service.createProject({
      name: 'Close',
      code: 'close',
      directoryGrantId: 'grant_close',
    });
    const page = await service.createPage(project.id, { name: 'Home', slug: 'home' });
    seed.close();
    const aborted = vi.fn();
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    vi.spyOn(PiAgentEngine.prototype, 'run').mockImplementation(async (request) => {
      entered();
      return new Promise((_resolve, reject) => {
        request.signal!.addEventListener(
          'abort',
          () => {
            aborted();
            reject(new AgentEngineError('CANCELLED', '模型请求已取消'));
          },
          { once: true },
        );
      });
    });
    const closed = vi.spyOn(ApplicationDatabase.prototype, 'close');
    const backend = await startServer({
      port: 0,
      databasePath: path,
      templatePath,
      desktopToken: 'fake-token',
      serviceInstanceId: 'test-instance',
    });
    try {
      const headers = { authorization: 'Bearer fake-token', 'x-origamix-service': 'test-instance' };
      const response = await http.server!.inject({
        method: 'POST',
        url: '/api/v1/agent/runs/create',
        headers,
        payload: {
          version: '1',
          projectId: project.id,
          pageId: page.id,
          baseWorkingVersion: 1,
          clientRequestId: 'close-request',
          content: { version: '1', blocks: [{ type: 'text', text: 'test' }] },
        },
      });
      expect(response.statusCode).toBe(202);
      const runId = response.json().data.runId as string;
      await started;
      const stream = http.server!.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/agent/runs/${runId}/events`,
        headers,
      });
      // Wait for the hijacked response, rather than relying on a fixed delay.
      await vi.waitFor(() => expect(http.subscribers()).toBe(1));
      await Promise.all([backend.close(), backend.close()]);
      expect((await stream).statusCode).toBe(200);
      expect(aborted).toHaveBeenCalledOnce();
      expect(closed).toHaveBeenCalledOnce();
      expect(aborted.mock.invocationCallOrder[0]).toBeLessThan(closed.mock.invocationCallOrder[0]!);
      const reopened = new ApplicationDatabase(path);
      try {
        expect(new AgentRunRepository(reopened).get(runId)?.status).toBe('cancelled');
      } finally {
        reopened.close();
      }
    } finally {
      await backend.close();
    }
  });

  it('interrupts an uncommitted active run without invoking a model', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-runtime-agent-'));
    directories.push(directory);
    const projectPath = join(directory, 'project');
    await mkdir(projectPath);
    const databasePath = join(directory, 'application.db');
    const database = new ApplicationDatabase(databasePath);
    const timestamp = new Date().toISOString();
    database.connection
      .prepare(
        'INSERT INTO projects (project_id, path, name, status, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run('project_a', projectPath, 'A', 0, timestamp, timestamp);
    database.connection
      .prepare(
        'INSERT INTO pages (page_id, project_id, slug, name, relative_path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run('page_a', 1, 'home', 'Home', 'pages/home', 0, timestamp, timestamp);
    const runs = new AgentRunRepository(database);
    const service = new ConversationService(
      database,
      new ProjectRepository(database),
      new ConversationRepository(database),
      runs,
    );
    const started = service.startRun({
      projectId: 'project_a',
      pageId: 'page_a',
      clientRequestId: 'startup-recovery',
      baseWorkingVersion: 1,
      content: { version: '1', blocks: [{ type: 'text', text: 'test' }] },
      modelRef: 'deepseek/deepseek-flash',
      runKind: 'page_assistant',
      budget: {
        maxModelCalls: 1,
        maxToolCalls: 1,
        maxOutputTokens: 1,
        maxDurationMs: 1,
        maxSchemaBytes: 1,
        maxRepairAttempts: 0,
      },
      promptVersion: '1',
      policyVersion: '1',
      toolsetVersion: '1',
      materialManifestVersion: 'official-antd@1.0.0',
    });
    await recoverAgentRunsOnStartup(runs, new ProjectRepository(database), service);
    expect(runs.get(started.run.id)).toMatchObject({
      status: 'interrupted',
      errorCode: 'PROCESS_INTERRUPTED',
    });
    database.close();
  });
});
