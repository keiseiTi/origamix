import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { ApplicationDatabase } from '../../database/database';
import { assertSchemaSafety, schemaSql } from '../../database/initialize';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe('ApplicationDatabase', () => {
  it('creates only the current durable domain tables and reopens them', async () => {
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
    database.close();
    const reopened = new ApplicationDatabase(path);
    expect(reopened.connection.prepare('SELECT COUNT(*) AS count FROM projects').get()).toEqual({
      count: 0,
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

  it('rejects a database with missing version metadata without modifying its records', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'origamix-db-invalid-version-'));
    directories.push(directory);
    const path = join(directory, 'origamix.db');
    const current = new ApplicationDatabase(path);
    current.connection.exec(
      "INSERT INTO projects VALUES (1, 'project_test', '/temporary', 'Keep me', 0, '2026-10-24', '2026-10-24')",
    );
    current.connection.exec('PRAGMA user_version = 0');
    current.close();
    expect(() => new ApplicationDatabase(path)).toThrow('版本信息');
    const preserved = new DatabaseSync(path);
    try {
      expect(preserved.prepare('SELECT name FROM projects').get()).toEqual({ name: 'Keep me' });
      expect(preserved.prepare('PRAGMA user_version').get()).toEqual({ user_version: 0 });
    } finally {
      preserved.close();
    }
  });
});

it('backs up a versioned database and rolls back a failed upgrade', async () => {
  const { readdir } = await import('node:fs/promises');
  const { migrateDatabase } = await import('../../database/migrations');
  const directory = await mkdtemp(join(tmpdir(), 'origamix-db-upgrade-'));
  directories.push(directory);
  const path = join(directory, 'origamix.db');
  const database = new ApplicationDatabase(path);
  const connection = database.connection;
  try {
    connection.exec(
      "INSERT INTO projects VALUES (1, 'project_test', '/temporary', 'Keep me', 0, '2026-10-23', '2026-10-23')",
    );
    migrateDatabase(connection);
    expect(connection.prepare('PRAGMA user_version').get()).toEqual({ user_version: 1 });
    const failed = [
      {
        from: 1,
        to: 2,
        release: '1.0.1',
        sql: 'ALTER TABLE projects ADD COLUMN migration_probe TEXT; INSERT INTO missing_table VALUES (1);',
      },
    ];
    expect(() => migrateDatabase(connection, failed, 2)).toThrow();
    expect((await readdir(directory)).filter((name) => name.endsWith('.bak'))).toHaveLength(1);
    expect(connection.prepare('PRAGMA user_version').get()).toEqual({ user_version: 1 });
    expect(connection.prepare('SELECT name FROM projects').get()).toEqual({ name: 'Keep me' });
    expect(
      connection
        .prepare('PRAGMA table_info(projects)')
        .all()
        .some((column) => column.name === 'migration_probe'),
    ).toBe(false);
    migrateDatabase(connection);
    migrateDatabase(
      connection,
      [
        {
          from: 1,
          to: 2,
          release: '1.0.1',
          sql: 'ALTER TABLE projects ADD COLUMN migration_probe TEXT;',
        },
        {
          from: 2,
          to: 3,
          release: '1.0.2',
          sql: "UPDATE projects SET migration_probe = 'converted';",
        },
      ],
      3,
      (current) => {
        expect(current.prepare('SELECT migration_probe FROM projects').get()).toEqual({
          migration_probe: 'converted',
        });
      },
    );
    expect(connection.prepare('PRAGMA user_version').get()).toEqual({ user_version: 3 });
    expect(() => migrateDatabase(connection)).toThrow('较新');
    expect(connection.prepare('SELECT name FROM projects').get()).toEqual({ name: 'Keep me' });
  } finally {
    connection.close();
  }
});
