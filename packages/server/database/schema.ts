import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text().primaryKey(),
  path: text().notNull().unique(),
  name: text().notNull(),
  status: integer().notNull().default(0),
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
    relativePath: text('relative_path').notNull(),
    status: integer().notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_pages_project_slug').on(table.projectId, table.slug),
    index('idx_pages_project_id').on(table.projectId),
  ],
);

export const conversations = sqliteTable(
  'conversations',
  {
    id: text().primaryKey(),
    projectId: text('project_id').notNull(),
    pageId: text('page_id').notNull(),
    title: text().notNull(),
    status: integer().notNull().default(0),
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
    status: integer().notNull(),
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
    baseWorkingVersion: integer('base_working_version').notNull(),
    resultRevisionId: text('result_revision_id'),
    resultWorkingVersion: integer('result_working_version'),
    modelRef: text('model_ref').notNull(),
    mode: text().notNull().default('page_modify'),
    status: integer().notNull(),
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

export const databaseSchema = {
  projects,
  pages,
  conversations,
  messages,
  agentRuns,
};
