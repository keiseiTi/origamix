import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text().primaryKey(),
  path: text().notNull().unique(),
  name: text().notNull(),
  formatVersion: text('format_version').notNull(),
  status: text().notNull().default('available'),
  createdAt: text('created_at').notNull(),
  lastOpenedAt: text('last_opened_at').notNull(),
});

export const pages = sqliteTable(
  'pages',
  {
    id: text().primaryKey(),
    projectId: text('project_id').notNull(),
    slug: text().notNull(),
    name: text().notNull(),
    route: text(),
    relativePath: text('relative_path').notNull(),
    status: text().notNull().default('active'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_pages_project_slug').on(table.projectId, table.slug),
    index('idx_pages_project_id').on(table.projectId),
  ],
);

export const workspaceState = sqliteTable('workspace_state', {
  id: integer().primaryKey(),
  theme: text().notNull().default('light'),
  sidebarState: text('sidebar_state').notNull().default('expanded'),
  updatedAt: text('updated_at').notNull(),
});

export const conversations = sqliteTable(
  'conversations',
  {
    id: text().primaryKey(),
    projectId: text('project_id').notNull(),
    pageId: text('page_id').notNull(),
    title: text().notNull(),
    status: text().notNull().default('active'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (table) => [
    index('idx_conversations_project_page').on(table.projectId, table.pageId, table.updatedAt),
  ],
);

export const messages = sqliteTable(
  'messages',
  {
    id: text().primaryKey(),
    conversationId: text('conversation_id').notNull(),
    runId: text('run_id'),
    role: text().notNull(),
    contentJson: text('content_json').notNull(),
    contentVersion: text('content_version').notNull().default('1'),
    status: text().notNull(),
    sequence: integer().notNull(),
    errorCode: text('error_code'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_messages_conversation_sequence').on(table.conversationId, table.sequence),
    index('idx_messages_conversation_created').on(table.conversationId, table.createdAt),
    index('idx_messages_run_id').on(table.runId),
  ],
);

export const agentRuns = sqliteTable(
  'agent_runs',
  {
    id: text().primaryKey(),
    projectId: text('project_id').notNull(),
    pageId: text('page_id').notNull(),
    conversationId: text('conversation_id').notNull(),
    userMessageId: text('user_message_id').notNull(),
    clientRequestId: text('client_request_id').notNull(),
    baseRevisionId: text('base_revision_id').notNull(),
    resultRevisionId: text('result_revision_id'),
    modelRef: text('model_ref').notNull(),
    mode: text().notNull().default('page_modify'),
    status: text().notNull(),
    budgetJson: text('budget_json').notNull(),
    promptVersion: text('prompt_version').notNull(),
    policyVersion: text('policy_version').notNull(),
    toolsetVersion: text('toolset_version').notNull(),
    materialManifestVersion: text('material_manifest_version').notNull(),
    retryOfRunId: text('retry_of_run_id'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    modelCalls: integer('model_calls').notNull().default(0),
    toolCalls: integer('tool_calls').notNull().default(0),
    durationMs: integer('duration_ms'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    finishedAt: text('finished_at'),
  },
  (table) => [
    uniqueIndex('idx_agent_runs_client_request').on(
      table.projectId,
      table.pageId,
      table.clientRequestId,
    ),
    index('idx_agent_runs_conversation_created').on(table.conversationId, table.createdAt),
    index('idx_agent_runs_recovery').on(table.status, table.updatedAt),
  ],
);

export const runtimeDiagnostics = sqliteTable(
  'runtime_diagnostics',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    projectId: text('project_id').notNull(),
    pageId: text('page_id').notNull(),
    revisionId: text('revision_id').notNull(),
    code: text().notNull(),
    severity: text().notNull(),
    stage: text().notNull(),
    elementId: text('element_id'),
    materialType: text('material_type'),
    safeMessage: text('safe_message').notNull(),
    observedAt: text('observed_at').notNull(),
  },
  (table) => [
    index('idx_runtime_diagnostics_page_revision').on(
      table.projectId,
      table.pageId,
      table.revisionId,
      table.id,
    ),
  ],
);

export const pageRuntimeState = sqliteTable(
  'page_runtime_state',
  {
    projectId: text('project_id').notNull(),
    pageId: text('page_id').notNull(),
    lastKnownGoodRevisionId: text('last_known_good_revision_id'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.pageId] })],
);

export const removedPages = sqliteTable(
  'removed_pages',
  {
    projectId: text('project_id').notNull(),
    pageId: text('page_id').notNull(),
    removedAt: text('removed_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.pageId] }),
    index('idx_removed_pages_project').on(table.projectId, table.removedAt),
  ],
);

export const databaseSchema = {
  projects,
  pages,
  workspaceState,
  conversations,
  messages,
  agentRuns,
  runtimeDiagnostics,
  pageRuntimeState,
  removedPages,
};
