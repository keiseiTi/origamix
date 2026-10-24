import type { DatabaseSync } from 'node:sqlite';
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
  if (!empty && version === 0) throw new Error('数据库缺少版本信息或结构不兼容');
  // Fresh databases use the current DDL directly; only versioned databases run upgrade steps.
  let nextVersion = empty ? targetVersion : version;
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
