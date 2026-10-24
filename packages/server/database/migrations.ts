import { DatabaseSync } from 'node:sqlite';
import { openSync, closeSync, renameSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
  assertCurrentSchema,
  assertSchemaSafety,
  currentUserTables,
  schemaSql,
} from './initialize';

export interface DatabaseMigration {
  from: number;
  to: number;
  release: string;
  sql: string;
}

// Database revisions advance only when storage changes. They are not user project versions.
export const DATABASE_VERSION = 1;
export const databaseMigrations: readonly DatabaseMigration[] = [];

const versionOf = (connection: DatabaseSync): number =>
  (connection.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;

/** Startup-only migrations. SQL and user_version commit in the same transaction. */
export const migrateDatabase = (
  connection: DatabaseSync,
  migrations: readonly DatabaseMigration[] = databaseMigrations,
  targetVersion = DATABASE_VERSION,
  validate: (connection: DatabaseSync) => void = assertCurrentSchema,
): void => {
  const version = versionOf(connection);
  if (version > targetVersion) throw new Error('数据库版本较新，请使用对应或更新的 Origamix');
  const empty = currentUserTables(connection).length === 0;
  if (empty && version !== 0) throw new Error('数据库版本记录与结构不一致');
  // Explicit adoption of the exact unversioned MVP schema; unknown structures are never guessed.
  if (!empty && version === 0) {
    assertCurrentSchema(connection);
    const expected = new DatabaseSync(':memory:');
    const definitions = (database: DatabaseSync) =>
      database
        .prepare(
          "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
        )
        .all();
    try {
      expected.exec(schemaSql);
      if (JSON.stringify(definitions(connection)) !== JSON.stringify(definitions(expected)))
        throw new Error('无版本数据库结构无法确认为初始 MVP，不能自动升级');
    } finally {
      expected.close();
    }
  }
  let nextVersion = version === 0 ? 1 : version;
  const steps: DatabaseMigration[] = [];
  while (nextVersion < targetVersion) {
    const matches = migrations.filter((step) => step.from === nextVersion);
    const step = matches[0];
    if (matches.length !== 1 || !step || step.to !== nextVersion + 1 || step.to > targetVersion)
      throw new Error('数据库缺少连续迁移路径');
    assertSchemaSafety(step.sql);
    steps.push(step);
    nextVersion = step.to;
  }
  if (version === targetVersion) {
    validate(connection);
    return;
  }
  assertSchemaSafety(schemaSql);
  if (!empty) {
    const file = (
      connection.prepare('PRAGMA database_list').all() as Array<{ name: string; file: string }>
    ).find((database) => database.name === 'main')?.file;
    // VACUUM INTO produces a consistent SQLite snapshot, including committed WAL data.
    if (file) {
      const backup = `${file}.before-v${version}-${randomUUID()}.bak`;
      const temporary = `${backup}.tmp`;
      closeSync(openSync(temporary, 'wx', 0o600));
      try {
        connection.prepare('VACUUM INTO ?').run(temporary);
        renameSync(temporary, backup);
      } catch (error) {
        rmSync(temporary, { force: true });
        throw error;
      }
    }
  }
  connection.exec('BEGIN IMMEDIATE');
  try {
    if (versionOf(connection) !== version) throw new Error('数据库已由另一进程升级，请重新启动');
    if (empty) connection.exec(schemaSql);
    for (const step of steps) connection.exec(step.sql);
    validate(connection);
    connection.exec(`PRAGMA user_version = ${targetVersion}`);
    connection.exec('COMMIT');
  } catch (error) {
    connection.exec('ROLLBACK');
    throw error;
  }
};
