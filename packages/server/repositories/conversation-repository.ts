import { Value } from '@sinclair/typebox/value';
import {
  MessageContentSchema,
  type AgentMessage,
  type MessageContent,
} from '@origamix/shared/protocol/agent';
import type { ApplicationDatabase } from '../database/database';

export type ConversationStatus = 'active' | 'archived' | 'deleted';

export interface ConversationRecord {
  id: string;
  projectId: string;
  pageId: string;
  title: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export type MessageStatus = 'pending' | 'streaming' | 'completed' | 'failed';

type ConversationRow = {
  id: string;
  project_id: string;
  page_id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  run_id: string | null;
  role: string;
  content_json: string;
  content_version: string;
  status: string;
  sequence: number;
  error_code: string | null;
  created_at: string;
  updated_at: string;
};

export interface StoredMessage extends AgentMessage {
  status: MessageStatus;
  updatedAt: string;
  errorCode?: string;
}

const conversationFromRow = (row: ConversationRow): ConversationRecord => ({
  id: row.id,
  projectId: row.project_id,
  pageId: row.page_id,
  title: row.title,
  status: row.status as ConversationStatus,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
});

function messageFromRow(row: MessageRow): StoredMessage {
  let content: unknown;
  try {
    content = JSON.parse(row.content_json);
  } catch {
    throw new Error(`消息 ${row.id} 的 content_json 不是合法 JSON`);
  }
  if (row.content_version !== '1' || !Value.Check(MessageContentSchema, content)) {
    throw new Error(`消息 ${row.id} 的内容不符合协议版本 ${row.content_version}`);
  }
  if (!['user', 'assistant', 'system'].includes(row.role)) {
    throw new Error(`消息 ${row.id} 的 role 无效`);
  }
  return {
    version: '1',
    messageId: row.id,
    conversationId: row.conversation_id,
    ...(row.run_id ? { runId: row.run_id } : {}),
    role: row.role as StoredMessage['role'],
    content: content as MessageContent,
    sequence: row.sequence,
    createdAt: row.created_at,
    status: row.status as MessageStatus,
    updatedAt: row.updated_at,
    ...(row.error_code ? { errorCode: row.error_code } : {}),
  };
}

export class ConversationRepository {
  constructor(private readonly database: ApplicationDatabase) {}

  create(record: ConversationRecord): ConversationRecord {
    this.database.connection
      .prepare(
        'INSERT INTO conversations (id, project_id, page_id, title, status, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        record.id,
        record.projectId,
        record.pageId,
        record.title,
        record.status,
        record.createdAt,
        record.updatedAt,
        record.deletedAt ?? null,
      );
    return record;
  }

  get(id: string, includeDeleted = false): ConversationRecord | undefined {
    const row = this.database.connection
      .prepare(
        `SELECT * FROM conversations WHERE id = ?${includeDeleted ? '' : " AND status != 'deleted'"}`,
      )
      .get(id) as ConversationRow | undefined;
    return row && conversationFromRow(row);
  }

  findActive(projectId: string, pageId: string): ConversationRecord | undefined {
    const row = this.database.connection
      .prepare(
        "SELECT * FROM conversations WHERE project_id = ? AND page_id = ? AND status = 'active' ORDER BY updated_at DESC LIMIT 1",
      )
      .get(projectId, pageId) as ConversationRow | undefined;
    return row && conversationFromRow(row);
  }

  list(projectId: string, pageId: string, limit = 50, before?: string): ConversationRecord[] {
    const rows = this.database.connection
      .prepare(
        `SELECT * FROM conversations WHERE project_id = ? AND page_id = ? AND status != 'deleted'
         AND (? IS NULL OR updated_at < ?) ORDER BY updated_at DESC LIMIT ?`,
      )
      .all(projectId, pageId, before ?? null, before ?? null, limit) as ConversationRow[];
    return rows.map(conversationFromRow);
  }

  touch(id: string, updatedAt: string): void {
    this.database.connection
      .prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
      .run(updatedAt, id);
  }

  softDelete(id: string, deletedAt: string): boolean {
    return (
      this.database.connection
        .prepare(
          "UPDATE conversations SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ? AND status != 'deleted'",
        )
        .run(deletedAt, deletedAt, id).changes > 0
    );
  }

  appendMessage(message: StoredMessage): StoredMessage {
    this.database.connection
      .prepare(
        'INSERT INTO messages (id, conversation_id, run_id, role, content_json, content_version, status, sequence, error_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        message.messageId,
        message.conversationId,
        message.runId ?? null,
        message.role,
        JSON.stringify(message.content),
        message.version,
        message.status,
        message.sequence,
        message.errorCode ?? null,
        message.createdAt,
        message.updatedAt,
      );
    return message;
  }

  updateMessage(
    id: string,
    input: {
      content: MessageContent;
      status: MessageStatus;
      updatedAt: string;
      errorCode?: string;
    },
  ): boolean {
    return (
      this.database.connection
        .prepare(
          'UPDATE messages SET content_json = ?, content_version = ?, status = ?, error_code = ?, updated_at = ? WHERE id = ?',
        )
        .run(
          JSON.stringify(input.content),
          input.content.version,
          input.status,
          input.errorCode ?? null,
          input.updatedAt,
          id,
        ).changes > 0
    );
  }

  getMessage(id: string): StoredMessage | undefined {
    const row = this.database.connection.prepare('SELECT * FROM messages WHERE id = ?').get(id) as
      MessageRow | undefined;
    return row && messageFromRow(row);
  }

  findAssistantByRun(runId: string): StoredMessage | undefined {
    const row = this.database.connection
      .prepare("SELECT * FROM messages WHERE run_id = ? AND role = 'assistant' LIMIT 1")
      .get(runId) as MessageRow | undefined;
    return row && messageFromRow(row);
  }

  nextSequence(conversationId: string): number {
    const row = this.database.connection
      .prepare(
        'SELECT COALESCE(MAX(sequence), -1) + 1 AS sequence FROM messages WHERE conversation_id = ?',
      )
      .get(conversationId) as { sequence: number };
    return row.sequence;
  }

  listMessages(conversationId: string, afterSequence = -1, limit = 100): StoredMessage[] {
    const rows = this.database.connection
      .prepare(
        'SELECT * FROM messages WHERE conversation_id = ? AND sequence > ? ORDER BY sequence LIMIT ?',
      )
      .all(conversationId, afterSequence, limit) as MessageRow[];
    return rows.map(messageFromRow);
  }

  listRecentMessages(conversationId: string, limit = 100): StoredMessage[] {
    const rows = this.database.connection
      .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY sequence DESC LIMIT ?')
      .all(conversationId, limit) as MessageRow[];
    return rows.reverse().map(messageFromRow);
  }

  listOrphanMessageIds(): string[] {
    return (
      this.database.connection
        .prepare(
          'SELECT messages.id FROM messages LEFT JOIN conversations ON conversations.id = messages.conversation_id WHERE conversations.id IS NULL ORDER BY messages.id',
        )
        .all() as Array<{ id: string }>
    ).map(({ id }) => id);
  }

  listOrphanConversationIds(): string[] {
    return (
      this.database.connection
        .prepare(
          `SELECT conversations.id FROM conversations
           LEFT JOIN projects ON projects.id = conversations.project_id
           LEFT JOIN pages ON pages.id = conversations.page_id AND pages.project_id = conversations.project_id
           WHERE projects.id IS NULL OR pages.id IS NULL ORDER BY conversations.id`,
        )
        .all() as Array<{ id: string }>
    ).map(({ id }) => id);
  }
}
