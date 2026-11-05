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
export const DATABASE_VERSION = 2;
// Frozen v1 → v2 DDL: later current-schema changes must not alter this migration.
const targetScopeMigration = `
ALTER TABLE conversations RENAME TO conversations_v1;
CREATE TABLE conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, page_id INTEGER, title TEXT NOT NULL, status INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
INSERT INTO conversations SELECT * FROM conversations_v1;
UPDATE sqlite_sequence SET seq = (SELECT max(seq) FROM sqlite_sequence WHERE name IN ('conversations', 'conversations_v1')) WHERE name = 'conversations';
DROP TABLE conversations_v1;
CREATE INDEX idx_conversations_project_page ON conversations(project_id, page_id, updated_at);
ALTER TABLE agent_runs RENAME TO agent_runs_v1;
CREATE TABLE agent_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, project_id INTEGER NOT NULL, page_id INTEGER, conversation_id INTEGER NOT NULL, user_message_id INTEGER NOT NULL, client_request_id TEXT NOT NULL, base_working_version INTEGER NOT NULL, result_working_version INTEGER, result_working_hash TEXT, model_ref TEXT NOT NULL, run_kind TEXT NOT NULL DEFAULT 'page_assistant', status INTEGER NOT NULL, outcome TEXT, outcome_json TEXT, repair_attempts INTEGER NOT NULL DEFAULT 0, operation_count INTEGER, operation_digest TEXT, budget_json TEXT NOT NULL, prompt_version TEXT NOT NULL, policy_version TEXT NOT NULL, toolset_version TEXT NOT NULL, material_manifest_version TEXT NOT NULL, retry_of_run_id INTEGER, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, model_calls INTEGER NOT NULL DEFAULT 0, tool_calls INTEGER NOT NULL DEFAULT 0, duration_ms INTEGER, error_code TEXT, error_message TEXT, failure_stage TEXT, recovered_commit INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, finished_at TEXT);
INSERT INTO agent_runs SELECT * FROM agent_runs_v1;
UPDATE sqlite_sequence SET seq = (SELECT max(seq) FROM sqlite_sequence WHERE name IN ('agent_runs', 'agent_runs_v1')) WHERE name = 'agent_runs';
DROP TABLE agent_runs_v1;
CREATE UNIQUE INDEX agent_runs_run_id_unique ON agent_runs(run_id);
CREATE UNIQUE INDEX idx_agent_runs_client_request ON agent_runs(project_id, page_id, client_request_id);
CREATE UNIQUE INDEX idx_agent_runs_layout_request ON agent_runs(project_id, client_request_id) WHERE page_id IS NULL;
CREATE INDEX idx_agent_runs_conversation_created ON agent_runs(conversation_id, created_at);
CREATE INDEX idx_agent_runs_recovery ON agent_runs(status, updated_at);
`;
export const databaseMigrations: readonly DatabaseMigration[] = [
  { from: 1, to: 2, release: '1.0.0', sql: targetScopeMigration },
];

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
