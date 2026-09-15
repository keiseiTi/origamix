import { and, asc, desc, eq, gt, isNull, lt, max, ne, or } from 'drizzle-orm';
import { Value } from '@sinclair/typebox/value';
import {
  MessageContentSchema,
  type AgentMessage,
  type MessageContent,
} from '@origamix/shared/protocol/agent';
import type { ApplicationDatabase, DatabaseClient } from '../database/database';
import { conversations, messages, pages, projects } from '../database/schema';
import { conversationStatus, messageStatus } from '../database/status';

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
export interface StoredMessage extends AgentMessage {
  status: MessageStatus;
  updatedAt: string;
  errorCode?: string;
}

const conversationFromRow = ({
  deletedAt,
  ...row
}: typeof conversations.$inferSelect): ConversationRecord => ({
  ...row,
  status: conversationStatus.decode(row.status),
  ...(deletedAt ? { deletedAt } : {}),
});
const messageFromRow = (row: typeof messages.$inferSelect): StoredMessage => {
  let content: unknown;
  try {
    content = JSON.parse(row.contentJson);
  } catch {
    throw new Error(`消息 ${row.id} 的 content_json 不是合法 JSON`);
  }
  if (row.contentVersion !== '1' || !Value.Check(MessageContentSchema, content))
    throw new Error(`消息 ${row.id} 的内容不符合协议版本 ${row.contentVersion}`);
  if (!['user', 'assistant', 'system'].includes(row.role))
    throw new Error(`消息 ${row.id} 的 role 无效`);
  return {
    version: '1',
    messageId: row.id,
    conversationId: row.conversationId,
    ...(row.runId ? { runId: row.runId } : {}),
    role: row.role as StoredMessage['role'],
    content: content as MessageContent,
    sequence: row.sequence,
    createdAt: row.createdAt,
    status: messageStatus.decode(row.status),
    updatedAt: row.updatedAt,
    ...(row.errorCode ? { errorCode: row.errorCode } : {}),
  };
};

export class ConversationRepository {
  private readonly client: DatabaseClient;
  constructor(database: ApplicationDatabase | DatabaseClient) {
    this.client = 'orm' in database ? database.orm : database;
  }
  create(record: ConversationRecord): ConversationRecord {
    this.client
      .insert(conversations)
      .values({
        ...record,
        status: conversationStatus.encode(record.status),
        deletedAt: record.deletedAt ?? null,
      })
      .run();
    return record;
  }
  get(id: string, includeDeleted = false): ConversationRecord | undefined {
    const row = this.client
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, id),
          ...(includeDeleted
            ? []
            : [ne(conversations.status, conversationStatus.encode('deleted'))]),
        ),
      )
      .get();
    return row && conversationFromRow(row);
  }
  findActive(projectId: string, pageId: string): ConversationRecord | undefined {
    const row = this.client
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.projectId, projectId),
          eq(conversations.pageId, pageId),
          eq(conversations.status, conversationStatus.encode('active')),
        ),
      )
      .orderBy(desc(conversations.updatedAt))
      .limit(1)
      .get();
    return row && conversationFromRow(row);
  }
  list(projectId: string, pageId: string, limit = 50, before?: string): ConversationRecord[] {
    return this.client
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.projectId, projectId),
          eq(conversations.pageId, pageId),
          ne(conversations.status, conversationStatus.encode('deleted')),
          ...(before ? [lt(conversations.updatedAt, before)] : []),
        ),
      )
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .all()
      .map(conversationFromRow);
  }
  touch(id: string, updatedAt: string): void {
    this.client.update(conversations).set({ updatedAt }).where(eq(conversations.id, id)).run();
  }
  softDelete(id: string, deletedAt: string): boolean {
    return (
      this.client
        .update(conversations)
        .set({ status: conversationStatus.encode('deleted'), deletedAt, updatedAt: deletedAt })
        .where(
          and(
            eq(conversations.id, id),
            ne(conversations.status, conversationStatus.encode('deleted')),
          ),
        )
        .run().changes > 0
    );
  }
  appendMessage(message: StoredMessage): StoredMessage {
    this.client
      .insert(messages)
      .values({
        id: message.messageId,
        conversationId: message.conversationId,
        runId: message.runId ?? null,
        role: message.role,
        contentJson: JSON.stringify(message.content),
        contentVersion: message.version,
        status: messageStatus.encode(message.status),
        sequence: message.sequence,
        errorCode: message.errorCode ?? null,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      })
      .run();
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
      this.client
        .update(messages)
        .set({
          contentJson: JSON.stringify(input.content),
          contentVersion: input.content.version,
          status: messageStatus.encode(input.status),
          errorCode: input.errorCode ?? null,
          updatedAt: input.updatedAt,
        })
        .where(eq(messages.id, id))
        .run().changes > 0
    );
  }
  getMessage(id: string): StoredMessage | undefined {
    const row = this.client.select().from(messages).where(eq(messages.id, id)).get();
    return row && messageFromRow(row);
  }
  findAssistantByRun(runId: string): StoredMessage | undefined {
    const row = this.client
      .select()
      .from(messages)
      .where(and(eq(messages.runId, runId), eq(messages.role, 'assistant')))
      .limit(1)
      .get();
    return row && messageFromRow(row);
  }
  nextSequence(conversationId: string): number {
    const row = this.client
      .select({ value: max(messages.sequence) })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .get();
    return (row?.value ?? -1) + 1;
  }
  listMessages(conversationId: string, afterSequence = -1, limit = 100): StoredMessage[] {
    return this.client
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), gt(messages.sequence, afterSequence)))
      .orderBy(asc(messages.sequence))
      .limit(limit)
      .all()
      .map(messageFromRow);
  }
  listRecentMessages(conversationId: string, limit = 100): StoredMessage[] {
    return this.client
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.sequence))
      .limit(limit)
      .all()
      .reverse()
      .map(messageFromRow);
  }
  listOrphanMessageIds(): string[] {
    return this.client
      .select({ id: messages.id })
      .from(messages)
      .leftJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(isNull(conversations.id))
      .orderBy(asc(messages.id))
      .all()
      .map(({ id }) => id);
  }
  listOrphanConversationIds(): string[] {
    return this.client
      .selectDistinct({ id: conversations.id })
      .from(conversations)
      .leftJoin(projects, eq(projects.id, conversations.projectId))
      .leftJoin(
        pages,
        and(eq(pages.id, conversations.pageId), eq(pages.projectId, conversations.projectId)),
      )
      .where(or(isNull(projects.id), isNull(pages.id)))
      .orderBy(asc(conversations.id))
      .all()
      .map(({ id }) => id);
  }
}
