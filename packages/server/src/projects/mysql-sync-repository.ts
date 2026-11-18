import type { ProjectSyncReceipt, ProjectSyncSnapshot } from '@origamix/shared';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

type Baseline = Record<string, string>;
type TargetRow = RowDataPacket & {
  baseline: string | null;
  pending: string | null;
};

// The calling service owns the project row lock throughout this transaction.
export class MysqlSyncRepository {
  constructor(
    private readonly sql: PoolConnection,
    private readonly projectId: string,
  ) {}

  async get(targetId: string) {
    const [rows] = await this.sql.execute<TargetRow[]>(
      'SELECT baseline, pending FROM origamix_web_sync_targets WHERE project_id = ? AND target_id = ?',
      [this.projectId, targetId],
    );
    const row = rows[0];
    return {
      baseline: row?.baseline ? (JSON.parse(row.baseline) as Baseline) : undefined,
      pending: row?.pending ? (JSON.parse(row.pending) as ProjectSyncSnapshot) : undefined,
    };
  }

  async prepare(targetId: string, snapshot: ProjectSyncSnapshot): Promise<void> {
    const pending = JSON.stringify(snapshot);
    await this.sql.execute(
      'INSERT INTO origamix_web_sync_targets (project_id, target_id, pending) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE pending = ?',
      [this.projectId, targetId, pending, pending],
    );
  }

  async getReceipt(targetId: string, snapshotId: string): Promise<ProjectSyncReceipt | undefined> {
    const [rows] = await this.sql.execute<(RowDataPacket & { completed_at: string })[]>(
      'SELECT completed_at FROM origamix_web_sync_receipts WHERE project_id = ? AND target_id = ? AND snapshot_id = ?',
      [this.projectId, targetId, snapshotId],
    );
    return rows[0] && { snapshotId, completedAt: rows[0].completed_at };
  }

  async finish(targetId: string, baseline: Baseline, receipt: ProjectSyncReceipt): Promise<void> {
    await this.sql.execute(
      'UPDATE origamix_web_sync_targets SET baseline = ?, pending = NULL WHERE project_id = ? AND target_id = ?',
      [JSON.stringify(baseline), this.projectId, targetId],
    );
    await this.sql.execute(
      'INSERT INTO origamix_web_sync_receipts (project_id, target_id, snapshot_id, completed_at) VALUES (?, ?, ?, ?)',
      [this.projectId, targetId, receipt.snapshotId, receipt.completedAt],
    );
  }
}
