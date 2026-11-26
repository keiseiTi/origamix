import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { AgentRunRepository, AgentRunRecord, PageAgentActivity } from './run-repository';
import type { AgentRunStore } from './persistence';
import type { ToolAuditEvent } from './tools/registry';

const activeStatus = "status NOT IN ('failed', 'completed', 'cancelled', 'interrupted')";

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

  listActive = () => this.read(activeStatus);

  async pageActivity(projectId: string, pageId: string): Promise<PageAgentActivity> {
    const [rows] = await this.sql.execute<
      (RowDataPacket & {
        runId: string | null;
        conversationId: string | null;
        workingVersion: number | string | null;
      })[]
    >(
      `SELECT MAX(CASE WHEN ${activeStatus} THEN id END) AS runId,
              MAX(CASE WHEN ${activeStatus} THEN JSON_UNQUOTE(JSON_EXTRACT(document, '$.conversationId')) END) AS conversationId,
              MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(document, '$.resultWorkingVersion')) AS UNSIGNED)) AS workingVersion
       FROM origamix_web_agent_runs WHERE project_id = ? AND page_id = ?`,
      [projectId, pageId],
    );
    const row = rows[0];
    return {
      activeRun:
        row?.runId && row.conversationId
          ? { runId: row.runId, conversationId: row.conversationId }
          : null,
      committedWorkingVersion: row?.workingVersion == null ? null : Number(row.workingVersion),
    };
  }

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
