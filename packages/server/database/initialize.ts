import type { DatabaseSync } from 'node:sqlite';

export const schemaSql = `
CREATE TABLE projects (id TEXT PRIMARY KEY, path TEXT NOT NULL, name TEXT NOT NULL, format_version TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'available', created_at TEXT NOT NULL, last_opened_at TEXT NOT NULL);
CREATE TABLE pages (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL, route TEXT, relative_path TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE workspace_state (id INTEGER PRIMARY KEY, theme TEXT NOT NULL DEFAULT 'light', sidebar_state TEXT NOT NULL DEFAULT 'expanded', updated_at TEXT NOT NULL);
CREATE TABLE conversations (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, page_id TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
CREATE TABLE messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, run_id TEXT, role TEXT NOT NULL, content_json TEXT NOT NULL, content_version TEXT NOT NULL DEFAULT '1', status TEXT NOT NULL, sequence INTEGER NOT NULL, error_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE agent_runs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, page_id TEXT NOT NULL, conversation_id TEXT NOT NULL, user_message_id TEXT NOT NULL, client_request_id TEXT NOT NULL, base_revision_id TEXT NOT NULL, result_revision_id TEXT, model_ref TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'page_modify', status TEXT NOT NULL, budget_json TEXT NOT NULL, prompt_version TEXT NOT NULL, policy_version TEXT NOT NULL, toolset_version TEXT NOT NULL, material_manifest_version TEXT NOT NULL, retry_of_run_id TEXT, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, model_calls INTEGER NOT NULL DEFAULT 0, tool_calls INTEGER NOT NULL DEFAULT 0, duration_ms INTEGER, error_code TEXT, error_message TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, finished_at TEXT);
CREATE TABLE runtime_diagnostics (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, page_id TEXT NOT NULL, revision_id TEXT NOT NULL, code TEXT NOT NULL, severity TEXT NOT NULL, stage TEXT NOT NULL, element_id TEXT, material_type TEXT, safe_message TEXT NOT NULL, observed_at TEXT NOT NULL);
CREATE TABLE page_runtime_state (project_id TEXT NOT NULL, page_id TEXT NOT NULL, last_known_good_revision_id TEXT, updated_at TEXT NOT NULL, PRIMARY KEY(project_id, page_id));
CREATE TABLE removed_pages (project_id TEXT NOT NULL, page_id TEXT NOT NULL, removed_at TEXT NOT NULL, PRIMARY KEY(project_id, page_id));
CREATE UNIQUE INDEX idx_pages_project_slug ON pages(project_id, slug);
CREATE UNIQUE INDEX projects_path_unique ON projects(path);
CREATE INDEX idx_pages_project_id ON pages(project_id);
CREATE INDEX idx_conversations_project_page ON conversations(project_id, page_id, updated_at);
CREATE UNIQUE INDEX idx_messages_conversation_sequence ON messages(conversation_id, sequence);
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_run_id ON messages(run_id);
CREATE UNIQUE INDEX idx_agent_runs_client_request ON agent_runs(project_id, page_id, client_request_id);
CREATE INDEX idx_agent_runs_conversation_created ON agent_runs(conversation_id, created_at);
CREATE INDEX idx_agent_runs_recovery ON agent_runs(status, updated_at);
CREATE INDEX idx_runtime_diagnostics_page_revision ON runtime_diagnostics(project_id, page_id, revision_id, id);
CREATE INDEX idx_removed_pages_project ON removed_pages(project_id, removed_at);
`;

const expectedColumns: Record<string, readonly string[]> = {
  projects: ['id', 'path', 'name', 'format_version', 'status', 'created_at', 'last_opened_at'],
  pages: [
    'id',
    'project_id',
    'slug',
    'name',
    'route',
    'relative_path',
    'status',
    'created_at',
    'updated_at',
  ],
  workspace_state: ['id', 'theme', 'sidebar_state', 'updated_at'],
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
    'project_id',
    'page_id',
    'conversation_id',
    'user_message_id',
    'client_request_id',
    'base_revision_id',
    'result_revision_id',
    'model_ref',
    'mode',
    'status',
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
    'created_at',
    'updated_at',
    'finished_at',
  ],
  runtime_diagnostics: [
    'id',
    'project_id',
    'page_id',
    'revision_id',
    'code',
    'severity',
    'stage',
    'element_id',
    'material_type',
    'safe_message',
    'observed_at',
  ],
  page_runtime_state: ['project_id', 'page_id', 'last_known_good_revision_id', 'updated_at'],
  removed_pages: ['project_id', 'page_id', 'removed_at'],
};

export const assertSchemaSafety = (sql: string): void => {
  if (/\b(foreign\s+key|references)\b/i.test(sql)) throw new Error('数据库结构不能包含外键约束');
};

const currentUserTables = (connection: DatabaseSync): string[] =>
  (
    connection
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>
  ).map(({ name }) => name);

const assertCurrentSchema = (connection: DatabaseSync): void => {
  const actualTables = currentUserTables(connection);
  const expectedTables = Object.keys(expectedColumns).sort();
  if (JSON.stringify(actualTables) !== JSON.stringify(expectedTables))
    throw new Error('数据库结构与当前版本不兼容；请备份后重建本地数据库');
  for (const [table, expected] of Object.entries(expectedColumns)) {
    const actual = (
      connection.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    ).map(({ name }) => name);
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new Error(`数据库表 ${table} 与当前版本不兼容；请备份后重建本地数据库`);
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
      connection
        .prepare(
          "INSERT INTO workspace_state (id, theme, sidebar_state, updated_at) VALUES (1, 'light', 'expanded', ?)",
        )
        .run(new Date().toISOString());
      connection.exec('COMMIT');
    } catch (error) {
      connection.exec('ROLLBACK');
      throw error;
    }
  }
  assertCurrentSchema(connection);
};
