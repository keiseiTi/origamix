import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { notFound } from '../errors';
import type {
  WorkingSchemaPageRef,
  SchemaStorage,
  WorkingSchemaFile,
  RevisionSnapshot,
  CommitJournal,
  AgentWorkingCommitReceipt,
} from './schema-storage';

type RecordKind = 'working' | 'revision' | 'journal' | 'agent_commit';
type DocumentRow = RowDataPacket & { document: string };

/** A schema store bound to one locked project's database transaction. */
export class MysqlSchemaStore implements SchemaStorage {
  constructor(
    private readonly connection: PoolConnection,
    private readonly projectId: string,
  ) {}

  private async read<T>(pageId: string, kind: RecordKind, id = ''): Promise<T | undefined> {
    const [rows] = await this.connection.execute<DocumentRow[]>(
      'SELECT document FROM origamix_web_schema_records WHERE project_id = ? AND page_id = ? AND kind = ? AND record_id = ?',
      [this.projectId, pageId, kind, id],
    );
    return rows.length ? (JSON.parse(rows[0].document) as T) : undefined;
  }

  private async write(pageId: string, kind: RecordKind, value: object, id = ''): Promise<void> {
    const document = JSON.stringify(value);
    const insert =
      'INSERT INTO origamix_web_schema_records (project_id, page_id, kind, record_id, document) VALUES (?, ?, ?, ?, ?)';
    const values = [this.projectId, pageId, kind, id, document];
    // Revisions are append-only. Other records can advance within the transaction.
    if (kind === 'revision') await this.connection.execute(insert, values);
    else
      await this.connection.execute(`${insert} ON DUPLICATE KEY UPDATE document = ?`, [
        ...values,
        document,
      ]);
  }

  async readWorking(page: WorkingSchemaPageRef) {
    const working = await this.readWorkingIfPresent(page);
    if (!working) throw notFound('页面工作副本不存在');
    return working;
  }

  readWorkingIfPresent = (page: WorkingSchemaPageRef) =>
    this.read<WorkingSchemaFile>(page.pageId, 'working');

  writeWorking = (page: WorkingSchemaPageRef, value: WorkingSchemaFile) =>
    this.write(page.pageId, 'working', value);

  async readRevision(page: WorkingSchemaPageRef, id: string) {
    const revision = await this.readRevisionIfPresent(page, id);
    if (!revision) throw notFound('页面版本不存在');
    return revision;
  }

  readRevisionIfPresent = (page: WorkingSchemaPageRef, id: string) =>
    this.read<RevisionSnapshot>(page.pageId, 'revision', id);

  async listRevisions(page: WorkingSchemaPageRef): Promise<RevisionSnapshot[]> {
    const [rows] = await this.connection.execute<DocumentRow[]>(
      "SELECT document FROM origamix_web_schema_records WHERE project_id = ? AND page_id = ? AND kind = 'revision'",
      [this.projectId, page.pageId],
    );
    return rows.map(({ document }) => JSON.parse(document) as RevisionSnapshot);
  }

  writeRevision = (page: WorkingSchemaPageRef, snapshot: RevisionSnapshot) =>
    this.write(page.pageId, 'revision', snapshot, snapshot.revisionId);

  readJournal = (page: WorkingSchemaPageRef) => this.read<CommitJournal>(page.pageId, 'journal');
  writeJournal = (page: WorkingSchemaPageRef, journal: CommitJournal) =>
    this.write(page.pageId, 'journal', journal);

  async removeJournal(page: WorkingSchemaPageRef): Promise<void> {
    await this.connection.execute(
      "DELETE FROM origamix_web_schema_records WHERE project_id = ? AND page_id = ? AND kind = 'journal'",
      [this.projectId, page.pageId],
    );
  }

  readAgentCommit = (page: WorkingSchemaPageRef, runId: string) =>
    this.read<AgentWorkingCommitReceipt>(page.pageId, 'agent_commit', runId);

  writeAgentCommit = (page: WorkingSchemaPageRef, receipt: AgentWorkingCommitReceipt) =>
    this.write(page.pageId, 'agent_commit', receipt, receipt.runId);

  async removePage(page: WorkingSchemaPageRef): Promise<void> {
    await this.connection.execute(
      'DELETE FROM origamix_web_schema_records WHERE project_id = ? AND page_id = ?',
      [this.projectId, page.pageId],
    );
  }
}
