export interface Migration {
  version: number;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE projects (
        id TEXT PRIMARY KEY, path TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        format_version TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'available',
        created_at TEXT NOT NULL, last_opened_at TEXT NOT NULL
      );
      CREATE TABLE pages (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL,
        relative_path TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(project_id, slug)
      );
      CREATE INDEX idx_pages_project_id ON pages(project_id);
      CREATE TABLE workspace_state (
        id INTEGER PRIMARY KEY CHECK (id = 1), active_project_id TEXT, active_page_id TEXT,
        theme TEXT NOT NULL DEFAULT 'light', sidebar_state TEXT NOT NULL DEFAULT 'expanded',
        updated_at TEXT NOT NULL
      );
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, page_id TEXT NOT NULL, title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_conversations_project_page ON conversations(project_id, page_id, updated_at);
      CREATE TABLE messages (
        id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content_json TEXT NOT NULL,
        status TEXT NOT NULL, sequence INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        UNIQUE(conversation_id, sequence)
      );
      CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at);
      CREATE TABLE agent_runs (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL, page_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
        model_ref TEXT NOT NULL, status TEXT NOT NULL, error_code TEXT, revision_id TEXT,
        started_at TEXT NOT NULL, finished_at TEXT
      );
      CREATE INDEX idx_agent_runs_conversation_started ON agent_runs(conversation_id, started_at);
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE conversations ADD COLUMN deleted_at TEXT;

      ALTER TABLE messages ADD COLUMN run_id TEXT;
      ALTER TABLE messages ADD COLUMN content_version TEXT NOT NULL DEFAULT '1';
      ALTER TABLE messages ADD COLUMN error_code TEXT;
      CREATE INDEX idx_messages_conversation_sequence ON messages(conversation_id, sequence);
      CREATE INDEX idx_messages_run_id ON messages(run_id);

      ALTER TABLE agent_runs ADD COLUMN user_message_id TEXT;
      ALTER TABLE agent_runs ADD COLUMN client_request_id TEXT;
      ALTER TABLE agent_runs ADD COLUMN base_revision_id TEXT;
      ALTER TABLE agent_runs ADD COLUMN result_revision_id TEXT;
      ALTER TABLE agent_runs ADD COLUMN mode TEXT NOT NULL DEFAULT 'page_modify';
      ALTER TABLE agent_runs ADD COLUMN budget_json TEXT NOT NULL DEFAULT '{"maxModelCalls":1,"maxToolCalls":1,"maxOutputTokens":1,"maxDurationMs":1,"maxSchemaBytes":1,"maxRepairAttempts":0}';
      ALTER TABLE agent_runs ADD COLUMN prompt_version TEXT NOT NULL DEFAULT 'unknown';
      ALTER TABLE agent_runs ADD COLUMN policy_version TEXT NOT NULL DEFAULT 'unknown';
      ALTER TABLE agent_runs ADD COLUMN toolset_version TEXT NOT NULL DEFAULT 'unknown';
      ALTER TABLE agent_runs ADD COLUMN material_manifest_version TEXT NOT NULL DEFAULT 'unknown';
      ALTER TABLE agent_runs ADD COLUMN retry_of_run_id TEXT;
      ALTER TABLE agent_runs ADD COLUMN input_tokens INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE agent_runs ADD COLUMN output_tokens INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE agent_runs ADD COLUMN model_calls INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE agent_runs ADD COLUMN tool_calls INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE agent_runs ADD COLUMN duration_ms INTEGER;
      ALTER TABLE agent_runs ADD COLUMN error_message TEXT;
      ALTER TABLE agent_runs ADD COLUMN updated_at TEXT;
      UPDATE agent_runs SET
        user_message_id = COALESCE(user_message_id, 'message_legacy_' || id),
        client_request_id = COALESCE(client_request_id, 'legacy_' || id),
        base_revision_id = COALESCE(base_revision_id, 'revision_legacy'),
        updated_at = COALESCE(updated_at, started_at);
      CREATE UNIQUE INDEX idx_agent_runs_client_request
        ON agent_runs(project_id, page_id, client_request_id)
        WHERE client_request_id IS NOT NULL;
      CREATE INDEX idx_agent_runs_recovery ON agent_runs(status, updated_at);
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE runtime_diagnostics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL, page_id TEXT NOT NULL, revision_id TEXT NOT NULL,
        code TEXT NOT NULL, severity TEXT NOT NULL, stage TEXT NOT NULL,
        element_id TEXT, material_type TEXT, safe_message TEXT NOT NULL, observed_at TEXT NOT NULL
      );
      CREATE INDEX idx_runtime_diagnostics_page_revision
        ON runtime_diagnostics(project_id, page_id, revision_id, id);

      CREATE TABLE page_runtime_state (
        project_id TEXT NOT NULL, page_id TEXT NOT NULL,
        last_known_good_revision_id TEXT, updated_at TEXT NOT NULL,
        PRIMARY KEY(project_id, page_id)
      );
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE removed_pages (
        project_id TEXT NOT NULL, page_id TEXT NOT NULL, removed_at TEXT NOT NULL,
        PRIMARY KEY(project_id, page_id)
      );
      CREATE INDEX idx_removed_pages_project ON removed_pages(project_id, removed_at);
    `,
  },
];

export function assertMigrationSafety(sql: string): void {
  if (/\b(foreign\s+key|references)\b/i.test(sql)) {
    throw new Error('Migration 不能包含外键约束');
  }
}
