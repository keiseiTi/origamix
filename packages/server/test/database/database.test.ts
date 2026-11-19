import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationDatabase } from '../../src/database/database';
import { assertSchemaSafety, DATABASE_VERSION, schemaSql } from '../../src/database/initialize';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('ApplicationDatabase', () => {
  it('creates current tables and rejects an existing v1 database without changing it', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-db-'));
    directories.push(directory);
    const path = join(directory, 'origamix.db');
    const database = new ApplicationDatabase(path);
    const tables = database.connection
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;
    expect(tables.map(({ name }) => name)).toEqual(
      expect.arrayContaining(['projects', 'pages', 'conversations', 'messages', 'agent_runs']),
    );
    expect(database.connection.prepare('PRAGMA user_version').get()).toEqual({
      user_version: DATABASE_VERSION,
    });
    database.close();
    const legacyPath = join(directory, 'legacy.db');
    const legacy = new DatabaseSync(legacyPath);
    legacy.exec(
      schemaSql
        .replace(
          /, reported_input_tokens INTEGER NOT NULL DEFAULT 0, reported_output_tokens INTEGER NOT NULL DEFAULT 0, fully_reported_calls INTEGER NOT NULL DEFAULT 0/,
          '',
        )
        .replace('CREATE INDEX idx_agent_runs_created ON agent_runs(created_at);', ''),
    );
    legacy.exec(
      "PRAGMA user_version = 1; INSERT INTO projects VALUES (1, 'project_test', '/temporary', 'Keep me', 0, '2026-10-24', '2026-10-24')",
    );
    legacy.close();
    expect(() => new ApplicationDatabase(legacyPath)).toThrow('数据库版本不受当前应用支持');
    const unchanged = new DatabaseSync(legacyPath, { readOnly: true });
    try {
      expect(unchanged.prepare('PRAGMA user_version').get()).toEqual({ user_version: 1 });
      expect(unchanged.prepare('SELECT name FROM projects').get()).toEqual({ name: 'Keep me' });
    } finally {
      unchanged.close();
    }
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

  it('rejects a current database missing the Agent request deduplication constraint', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-db-index-'));
    directories.push(directory);
    const path = join(directory, 'origamix.db');
    const database = new ApplicationDatabase(path);
    database.connection.exec('DROP INDEX idx_agent_runs_client_request');
    database.close();

    expect(() => new ApplicationDatabase(path)).toThrow('唯一索引');
    const preserved = new DatabaseSync(path);
    try {
      expect(preserved.prepare('PRAGMA user_version').get()).toEqual({
        user_version: DATABASE_VERSION,
      });
      expect(
        preserved
          .prepare("SELECT name FROM sqlite_schema WHERE name = 'idx_agent_runs_client_request'")
          .get(),
      ).toBeUndefined();
    } finally {
      preserved.close();
    }
  });

  it('rejects a database with an unsupported version without modifying its records', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-db-invalid-version-'));
    directories.push(directory);
    const path = join(directory, 'origamix.db');
    const current = new ApplicationDatabase(path);
    current.connection.exec(
      "INSERT INTO projects VALUES (1, 'project_test', '/temporary', 'Keep me', 0, '2026-10-24', '2026-10-24')",
    );
    current.connection.exec('PRAGMA user_version = 3');
    current.close();
    expect(() => new ApplicationDatabase(path)).toThrow('版本不受');
    const preserved = new DatabaseSync(path);
    try {
      expect(preserved.prepare('SELECT name FROM projects').get()).toEqual({ name: 'Keep me' });
      expect(preserved.prepare('PRAGMA user_version').get()).toEqual({ user_version: 3 });
    } finally {
      preserved.close();
    }
  });
});
