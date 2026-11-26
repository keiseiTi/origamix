import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { ConversationRecord, StoredMessage } from './conversation-repository';

type DocumentRow = RowDataPacket & { document: string };
const documents = <T>(rows: DocumentRow[]) => rows.map(({ document }) => JSON.parse(document) as T);

export class MysqlConversationRepository {
  constructor(private readonly sql: Pool | PoolConnection) {}

  async list(projectId: string, pageId: string, limit: number, offset = 0) {
    const [rows] = await this.sql.execute<DocumentRow[]>(
      'SELECT document FROM origamix_web_conversations WHERE project_id = ? AND page_id = ? ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?',
      [projectId, pageId, limit, offset],
    );
    return documents<ConversationRecord>(rows);
  }

  async get(id: string, lock = false) {
    const [rows] = await this.sql.execute<DocumentRow[]>(
      `SELECT document FROM origamix_web_conversations WHERE id = ?${lock ? ' FOR UPDATE' : ''}`,
      [id],
    );
    return documents<ConversationRecord>(rows)[0];
  }

  async insert(conversation: ConversationRecord) {
    await this.sql.execute(
      'INSERT INTO origamix_web_conversations (id, project_id, page_id, updated_at, document) VALUES (?, ?, ?, ?, ?)',
      [
        conversation.id,
        conversation.projectId,
        conversation.pageId,
        conversation.updatedAt,
        JSON.stringify(conversation),
      ],
    );
  }

  async touch(conversation: ConversationRecord) {
    await this.sql.execute(
      'UPDATE origamix_web_conversations SET updated_at = ?, document = ? WHERE id = ?',
      [conversation.updatedAt, JSON.stringify(conversation), conversation.id],
    );
  }

  async listMessages(id: string, after: number, limit: number, recent = false) {
    const [rows] = await this.sql.execute<DocumentRow[]>(
      `SELECT document FROM origamix_web_messages WHERE conversation_id = ? AND sequence_no > ?
       ORDER BY sequence_no ${recent ? 'DESC' : 'ASC'} LIMIT ?`,
      [id, after, limit],
    );
    const messages = documents<StoredMessage>(rows);
    return recent ? messages.reverse() : messages;
  }

  async findMessage(id: string) {
    const [rows] = await this.sql.execute<DocumentRow[]>(
      'SELECT document FROM origamix_web_messages WHERE id = ?',
      [id],
    );
    return documents<StoredMessage>(rows)[0];
  }

  async findAssistant(runId: string) {
    const [rows] = await this.sql.execute<DocumentRow[]>(
      "SELECT document FROM origamix_web_messages WHERE run_id = ? AND role = 'assistant'",
      [runId],
    );
    return documents<StoredMessage>(rows)[0];
  }

  async nextSequence(id: string): Promise<number> {
    const [rows] = await this.sql.execute<(RowDataPacket & { sequence_no: number })[]>(
      'SELECT sequence_no FROM origamix_web_messages WHERE conversation_id = ? ORDER BY sequence_no DESC LIMIT 1',
      [id],
    );
    return (rows[0]?.sequence_no ?? 0) + 1;
  }

  async append(message: StoredMessage) {
    await this.sql.execute(
      'INSERT INTO origamix_web_messages (id, conversation_id, run_id, role, sequence_no, document) VALUES (?, ?, ?, ?, ?, ?)',
      [
        message.messageId,
        message.conversationId,
        message.runId ?? null,
        message.role,
        message.sequence,
        JSON.stringify(message),
      ],
    );
    return message;
  }

  async replace(message: StoredMessage) {
    await this.sql.execute('UPDATE origamix_web_messages SET document = ? WHERE id = ?', [
      JSON.stringify(message),
      message.messageId,
    ]);
    return message;
  }
}
