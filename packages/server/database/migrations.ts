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
];

export function assertMigrationSafety(sql: string): void {
  if (/\b(foreign\s+key|references)\b/i.test(sql)) {
    throw new Error('Migration 不能包含外键约束');
  }
}
