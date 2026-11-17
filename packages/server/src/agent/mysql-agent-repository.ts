import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { AgentRunRepository, AgentRunRecord } from './run-repository';
import type { AgentRunStore } from './persistence';
import type { ToolAuditEvent } from './tools/registry';

type DocumentRow = RowDataPacket & { document: string };

export class MysqlAgentRunRepository implements AgentRunStore {
  constructor(private readonly sql: Pool | PoolConnection) {}

  private async read(conditions: string, params: string[] = []): Promise<AgentRunRecord[]> {
    const [rows] = await this.sql.execute<DocumentRow[]>(
      `SELECT document FROM origamix_web_agent_runs WHERE ${conditions}`,
      params,
    );
    return rows.map(({ document }) => JSON.parse(document) as AgentRunRecord);
  }

  get = async (id: string) => (await this.read('id = ?', [id]))[0];

  findByClientRequest = async (projectId: string, pageId: string | undefined, requestId: string) =>
    (
      await this.read('project_id = ? AND page_id = ? AND client_request_id = ?', [
        projectId,
        pageId ?? '',
        requestId,
      ])
    )[0];

  listActive = () => this.read("status NOT IN ('failed', 'completed', 'cancelled', 'interrupted')");

  async create(run: AgentRunRecord): Promise<void> {
    await this.sql.execute(
      'INSERT INTO origamix_web_agent_runs (id, project_id, page_id, client_request_id, status, document) VALUES (?, ?, ?, ?, ?, ?)',
      [run.id, run.projectId, run.pageId, run.clientRequestId, run.status, JSON.stringify(run)],
    );
  }

  async updateStatus(...[id, expected, patch]: Parameters<AgentRunRepository['updateStatus']>) {
    if (!expected.length) return false;
    const [result] = await this.sql.execute<ResultSetHeader>(
      `UPDATE origamix_web_agent_runs SET status = ?, document = JSON_MERGE_PATCH(document, ?)
       WHERE id = ? AND status IN (${expected.map(() => '?').join(', ')})`,
      [
        patch.status,
        JSON.stringify({ errorCode: null, errorMessage: null, ...patch }),
        id,
        ...expected,
      ],
    );
    return result.affectedRows > 0;
  }

  async updateMetrics(...[id, metrics]: Parameters<AgentRunRepository['updateMetrics']>) {
    const [result] = await this.sql.execute<ResultSetHeader>(
      'UPDATE origamix_web_agent_runs SET document = JSON_MERGE_PATCH(document, ?) WHERE id = ?',
      [JSON.stringify({ ...metrics, updatedAt: new Date().toISOString() }), id],
    );
    return result.affectedRows > 0;
  }

  async appendAudit(event: ToolAuditEvent): Promise<void> {
    await this.sql.execute(
      'INSERT INTO origamix_web_tool_audits (run_id, document) VALUES (?, ?)',
      [event.runId, JSON.stringify(event)],
    );
  }
}
