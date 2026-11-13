import { DatabaseSync } from 'node:sqlite';
import { deepStrictEqual } from 'node:assert';

export const schemaSql = `
CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, path TEXT NOT NULL, name TEXT NOT NULL, status INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_opened_at TEXT NOT NULL);
CREATE TABLE pages (id INTEGER PRIMARY KEY AUTOINCREMENT, page_id TEXT NOT NULL, project_id INTEGER NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL, relative_path TEXT NOT NULL, status INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL, page_id INTEGER NOT NULL, title TEXT NOT NULL, status INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id INTEGER NOT NULL, run_id INTEGER, role TEXT NOT NULL, content_json TEXT NOT NULL, content_version TEXT NOT NULL DEFAULT '1', status INTEGER NOT NULL, sequence INTEGER NOT NULL, error_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE agent_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL, project_id INTEGER NOT NULL, page_id INTEGER NOT NULL, conversation_id INTEGER NOT NULL, user_message_id INTEGER NOT NULL, client_request_id TEXT NOT NULL, base_working_version INTEGER NOT NULL, result_working_version INTEGER, result_working_hash TEXT, model_ref TEXT NOT NULL, run_kind TEXT NOT NULL DEFAULT 'page_assistant', status INTEGER NOT NULL, outcome TEXT, outcome_json TEXT, repair_attempts INTEGER NOT NULL DEFAULT 0, operation_count INTEGER, operation_digest TEXT, budget_json TEXT NOT NULL, prompt_version TEXT NOT NULL, policy_version TEXT NOT NULL, toolset_version TEXT NOT NULL, material_manifest_version TEXT NOT NULL, retry_of_run_id INTEGER, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, model_calls INTEGER NOT NULL DEFAULT 0, tool_calls INTEGER NOT NULL DEFAULT 0, duration_ms INTEGER, error_code TEXT, error_message TEXT, failure_stage TEXT, recovered_commit INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, finished_at TEXT);
CREATE TABLE agent_tool_audits (id INTEGER PRIMARY KEY AUTOINCREMENT, run_id INTEGER NOT NULL, sequence INTEGER NOT NULL, tool_name TEXT NOT NULL, phase TEXT NOT NULL, safe_error_code TEXT, duration_ms INTEGER NOT NULL, operation_count INTEGER, operation_type_counts_json TEXT, operation_digest TEXT, occurred_at TEXT NOT NULL);
CREATE UNIQUE INDEX idx_pages_project_slug ON pages(project_id, slug);
CREATE UNIQUE INDEX projects_project_id_unique ON projects(project_id);
CREATE UNIQUE INDEX pages_page_id_unique ON pages(page_id);
CREATE UNIQUE INDEX agent_runs_run_id_unique ON agent_runs(run_id);
CREATE UNIQUE INDEX projects_path_unique ON projects(path);
CREATE INDEX idx_pages_project_id ON pages(project_id);
CREATE INDEX idx_conversations_project_page ON conversations(project_id, page_id, updated_at);
CREATE UNIQUE INDEX idx_messages_conversation_sequence ON messages(conversation_id, sequence);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_run_id ON messages(run_id);
CREATE UNIQUE INDEX idx_agent_runs_client_request ON agent_runs(project_id, page_id, client_request_id);
CREATE INDEX idx_agent_runs_conversation_created ON agent_runs(conversation_id, created_at);
CREATE INDEX idx_agent_runs_recovery ON agent_runs(status, updated_at);
CREATE UNIQUE INDEX idx_agent_tool_audits_run_sequence ON agent_tool_audits(run_id, sequence);
CREATE INDEX idx_agent_tool_audits_run ON agent_tool_audits(run_id, occurred_at);
`;

export const assertSchemaSafety = (sql: string): void => {
  if (/\b(foreign\s+key|references)\b/i.test(sql)) throw new Error('数据库结构不能包含外键约束');
};

export class IncompatibleDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IncompatibleDatabaseError';
  }
}

export const currentUserTables = (connection: DatabaseSync): string[] =>
  (
    connection
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>
  ).map(({ name }) => name);

const tableColumns = (connection: DatabaseSync, table: string) =>
  connection.prepare('SELECT * FROM pragma_table_info(?) ORDER BY cid').all(table);

const uniqueIndexes = (connection: DatabaseSync, table: string) => {
  const indexes = connection
    .prepare('SELECT name, partial FROM pragma_index_list(?) WHERE "unique" = 1 ORDER BY name')
    .all(table) as { name: string; partial: number }[];
  const columns = connection.prepare('SELECT * FROM pragma_index_xinfo(?) ORDER BY seqno');
  return new Map(
    indexes.map(({ name, partial }) => [name, { partial, columns: columns.all(name) }]),
  );
};

const readSchemaContract = () => {
  const reference = new DatabaseSync(':memory:');
  try {
    assertSchemaSafety(schemaSql);
    reference.exec(schemaSql);
    return currentUserTables(reference).map((table) => ({
      table,
      columns: tableColumns(reference, table),
      indexes: uniqueIndexes(reference, table),
    }));
  } finally {
    reference.close();
  }
};

const expectedSchema = readSchemaContract();

export const assertCurrentSchema = (connection: DatabaseSync): void => {
  const actualTables = currentUserTables(connection);
  const expectedTables = expectedSchema.map(({ table }) => table);
  if (JSON.stringify(actualTables) !== JSON.stringify(expectedTables))
    throw new IncompatibleDatabaseError('数据库结构与当前版本不兼容');
  for (const { table, columns, indexes } of expectedSchema) {
    if (connection.prepare('SELECT 1 FROM pragma_foreign_key_list(?) LIMIT 1').get(table))
      throw new Error(`数据库表 ${table} 包含禁止的外键`);
    const actualIndexes = uniqueIndexes(connection, table);
    try {
      deepStrictEqual(tableColumns(connection, table), columns);
      for (const [name, expected] of indexes) deepStrictEqual(actualIndexes.get(name), expected);
    } catch {
      throw new IncompatibleDatabaseError(`数据库表 ${table} 的列或唯一索引与当前版本不兼容`);
    }
  }
};

export const DATABASE_VERSION = 1;
/** Create a fresh current database or validate exactly the current storage contract. No migration. */
export const initializeDatabase = (connection: DatabaseSync): void => {
  const version = (connection.prepare('PRAGMA user_version').get() as { user_version: number })
    .user_version;
  const empty = currentUserTables(connection).length === 0;
  if (!empty) {
    if (version === 0) throw new Error('数据库缺少版本信息');
    if (version !== DATABASE_VERSION) throw new Error('数据库版本不受当前应用支持');
    assertCurrentSchema(connection);
    return;
  }
  if (version !== 0) throw new Error('数据库版本记录与结构不一致');
  connection.exec('BEGIN IMMEDIATE');
  try {
    connection.exec(schemaSql);
    connection.exec(`PRAGMA user_version = ${DATABASE_VERSION}`);
    assertCurrentSchema(connection);
    connection.exec('COMMIT');
  } catch (error) {
    connection.exec('ROLLBACK');
    throw error;
  }
};
