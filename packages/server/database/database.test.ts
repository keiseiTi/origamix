import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationDatabase } from './database';
import { assertSchemaSafety, schemaSql } from './initialize';
import { WorkspaceRepository } from '../repositories/workspace-repository';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('ApplicationDatabase', () => {
  it('creates the current schema and preserves workspace state on reopen', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-db-'));
    directories.push(directory);
    const path = join(directory, 'origamix.db');
    const database = new ApplicationDatabase(path);
    const tables = database.connection
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;
    expect(tables.map(({ name }) => name)).toEqual(
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
    expect(tables.map(({ name }) => name)).not.toContain('app_meta');
    const workspace = new WorkspaceRepository(database);
    expect(workspace.save({ theme: 'dark', sidebarCollapsed: true })).toMatchObject({
      theme: 'dark',
      sidebarCollapsed: true,
    });
    database.close();
    const reopened = new ApplicationDatabase(path);
    expect(new WorkspaceRepository(reopened).get()).toMatchObject({
      theme: 'dark',
      sidebarCollapsed: true,
    });
    reopened.close();
  });

  it('contains no foreign keys in generated current-schema SQL or the database', async () => {
    expect(() => assertSchemaSafety(schemaSql)).not.toThrow();
    expect(() =>
      assertSchemaSafety('CREATE TABLE child (parent_id TEXT REFERENCES parents(id))'),
    ).toThrow('外键');
    const directory = await mkdtemp(join(tmpdir(), 'origamix-db-fk-'));
    directories.push(directory);
    const database = new ApplicationDatabase(join(directory, 'origamix.db'));
    const tables = database.connection
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>;
    for (const { name } of tables)
      expect(database.connection.prepare(`PRAGMA foreign_key_list(${name})`).all()).toEqual([]);
    database.close();
  });

  it('rebuilds an incompatible existing database during the MVP phase', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-db-old-'));
    directories.push(directory);
    const path = join(directory, 'origamix.db');
    const legacy = new DatabaseSync(path);
    legacy.exec('CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    legacy.close();
    const rebuilt = new ApplicationDatabase(path);
    expect(
      rebuilt.connection
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_meta'")
        .get(),
    ).toBeUndefined();
    expect(
      rebuilt.connection
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'projects'")
        .get(),
    ).toBeTruthy();
    expect(new WorkspaceRepository(rebuilt).get()).toMatchObject({ theme: 'light' });
    rebuilt.close();
  });
});
