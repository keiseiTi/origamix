import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationDatabase } from './database';
import { assertMigrationSafety, migrations } from './migrations';
import { AgentRunRepository } from '../repositories/agent-run-repository';
import { WorkspaceRepository } from '../repositories/workspace-repository';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('ApplicationDatabase', () => {
  it('applies the local persistence migration and initializes workspace state', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-db-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const tables = database.connection
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;

    expect(tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        'projects',
        'pages',
        'workspace_state',
        'conversations',
        'messages',
        'agent_runs',
        'runtime_diagnostics',
        'page_runtime_state',
        'removed_pages',
      ]),
    );
    const workspace = new WorkspaceRepository(database);
    expect(workspace.get()).toMatchObject({ theme: 'light', sidebarCollapsed: false });
    expect(workspace.save({ theme: 'dark', sidebarCollapsed: true })).toMatchObject({
      theme: 'dark',
      sidebarCollapsed: true,
    });
    database.close();
  });

  it('rejects migrations that introduce foreign keys', () => {
    expect(() =>
      assertMigrationSafety('CREATE TABLE child (parent_id TEXT REFERENCES parents(id))'),
    ).toThrow('外键');
  });

  it('upgrades and reopens a version 1 database without losing legacy run state', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-db-v1-'));
    directories.push(directory);
    const path = join(directory, 'origamix.db');
    const legacy = new DatabaseSync(path);
    legacy.exec(migrations[0]!.sql);
    legacy.prepare("INSERT INTO app_meta (key, value) VALUES ('schema_version', '1')").run();
    const timestamp = new Date().toISOString();
    legacy
      .prepare(
        'INSERT INTO agent_runs (id, project_id, page_id, conversation_id, model_ref, status, error_code, revision_id, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'run_legacy',
        'project_a',
        'page_a',
        'conversation_a',
        'legacy/model',
        'failed',
        'LEGACY_ERROR',
        null,
        timestamp,
        timestamp,
      );
    legacy.close();

    const upgraded = new ApplicationDatabase(path);
    expect(new AgentRunRepository(upgraded).get('run_legacy')).toMatchObject({
      status: 'failed',
      clientRequestId: 'legacy_run_legacy',
      errorCode: 'LEGACY_ERROR',
    });
    upgraded.close();

    const reopened = new ApplicationDatabase(path);
    expect(
      reopened.connection.prepare("SELECT value FROM app_meta WHERE key = 'schema_version'").get(),
    ).toMatchObject({ value: '5' });
    reopened.close();
  });
});
