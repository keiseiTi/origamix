import type { DatabaseSync } from 'node:sqlite';

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

const expectedColumns: Record<string, readonly string[]> = {
  projects: ['id', 'project_id', 'path', 'name', 'status', 'created_at', 'last_opened_at'],
  pages: [
    'id',
    'page_id',
    'project_id',
    'slug',
    'name',
    'relative_path',
    'status',
    'created_at',
    'updated_at',
  ],
  conversations: [
    'id',
    'project_id',
    'page_id',
    'title',
    'status',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  messages: [
    'id',
    'conversation_id',
    'run_id',
    'role',
    'content_json',
    'content_version',
    'status',
    'sequence',
    'error_code',
    'created_at',
    'updated_at',
  ],
  agent_runs: [
    'id',
    'run_id',
    'project_id',
    'page_id',
    'conversation_id',
    'user_message_id',
    'client_request_id',
    'base_working_version',
    'result_working_version',
    'result_working_hash',
    'model_ref',
    'run_kind',
    'status',
    'outcome',
    'outcome_json',
    'repair_attempts',
    'operation_count',
    'operation_digest',
    'budget_json',
    'prompt_version',
    'policy_version',
    'toolset_version',
    'material_manifest_version',
    'retry_of_run_id',
    'input_tokens',
    'output_tokens',
    'model_calls',
    'tool_calls',
    'duration_ms',
    'error_code',
    'error_message',
    'failure_stage',
    'recovered_commit',
    'created_at',
    'updated_at',
    'finished_at',
  ],
  agent_tool_audits: [
    'id',
    'run_id',
    'sequence',
    'tool_name',
    'phase',
    'safe_error_code',
    'duration_ms',
    'operation_count',
    'operation_type_counts_json',
    'operation_digest',
    'occurred_at',
  ],
};

export const assertSchemaSafety = (sql: string): void => {
  if (/\b(foreign\s+key|references)\b/i.test(sql)) throw new Error('数据库结构不能包含外键约束');
};

export class IncompatibleDatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IncompatibleDatabaseError';
  }
}

const currentUserTables = (connection: DatabaseSync): string[] =>
  (
    connection
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>
  ).map(({ name }) => name);

const tableColumns = (connection: DatabaseSync, table: string): string[] =>
  (connection.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map(
    ({ name }) => name,
  );

const assertCurrentSchema = (connection: DatabaseSync): void => {
  const actualTables = currentUserTables(connection);
  const expectedTables = Object.keys(expectedColumns).sort();
  if (JSON.stringify(actualTables) !== JSON.stringify(expectedTables))
    throw new IncompatibleDatabaseError('数据库结构与当前版本不兼容');
  for (const [table, expected] of Object.entries(expectedColumns)) {
    const actual = tableColumns(connection, table);
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new IncompatibleDatabaseError(`数据库表 ${table} 与当前版本不兼容`);
    if ((connection.prepare(`PRAGMA foreign_key_list(${table})`).all() as unknown[]).length > 0)
      throw new Error(`数据库表 ${table} 包含禁止的外键`);
  }
};

export const initializeDatabase = (connection: DatabaseSync): void => {
  assertSchemaSafety(schemaSql);
  if (currentUserTables(connection).length === 0) {
    connection.exec('BEGIN IMMEDIATE');
    try {
      connection.exec(schemaSql);
      connection.exec('COMMIT');
    } catch (error) {
      connection.exec('ROLLBACK');
      throw error;
    }
  }
  assertCurrentSchema(connection);
};
