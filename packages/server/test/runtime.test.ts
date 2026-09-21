import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationDatabase } from '../database/database';
import { AgentRunRepository } from '../agent/run-repository';
import { ConversationRepository } from '../conversations/conversation-repository';
import { ProjectRepository } from '../projects/project-repository';
import { ConversationService } from '../conversations/conversation-service';
import { recoverAgentRunsOnStartup } from '../agent/run-recovery';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('server startup Agent recovery', () => {
  it('interrupts an uncommitted active run without invoking a model', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-runtime-agent-'));
    directories.push(directory);
    const databasePath = join(directory, 'application.db');
    const database = new ApplicationDatabase(databasePath);
    const timestamp = new Date().toISOString();
    database.connection
      .prepare(
        'INSERT INTO projects (id, path, name, status, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run('project_a', join(directory, 'missing-project'), 'A', 0, timestamp, timestamp);
    database.connection
      .prepare(
        'INSERT INTO pages (id, project_id, slug, name, relative_path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run('page_a', 'project_a', 'home', 'Home', 'pages/home', 0, timestamp, timestamp);
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
      mode: 'page_modify',
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
    await recoverAgentRunsOnStartup(runs, new ProjectRepository(database));
    expect(runs.get(started.run.id)).toMatchObject({
      status: 'interrupted',
      errorCode: 'PROCESS_INTERRUPTED',
    });
    database.close();
  });
});
