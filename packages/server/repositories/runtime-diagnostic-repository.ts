import type { RuntimeDiagnostic } from '@origamix/shared/protocol/agent';
import type { ApplicationDatabase } from '../database/database';

type DiagnosticRow = {
  code: string;
  severity: RuntimeDiagnostic['severity'];
  stage: RuntimeDiagnostic['stage'];
  page_id: string;
  revision_id: string;
  element_id: string | null;
  material_type: string | null;
  safe_message: string;
};

export class RuntimeDiagnosticRepository {
  constructor(private readonly database: ApplicationDatabase) {}

  replaceForRevision(
    projectId: string,
    pageId: string,
    revisionId: string,
    diagnostics: readonly RuntimeDiagnostic[],
    observedAt: string,
  ): void {
    const db = this.database.connection;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        'DELETE FROM runtime_diagnostics WHERE project_id = ? AND page_id = ? AND revision_id = ?',
      ).run(projectId, pageId, revisionId);
      const insert = db.prepare(
        `INSERT INTO runtime_diagnostics (
          project_id, page_id, revision_id, code, severity, stage, element_id,
          material_type, safe_message, observed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const item of diagnostics) {
        insert.run(
          projectId,
          pageId,
          revisionId,
          item.code,
          item.severity,
          item.stage,
          item.elementId ?? null,
          item.materialType ?? null,
          item.safeMessage,
          observedAt,
        );
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  listForRevision(projectId: string, pageId: string, revisionId: string): RuntimeDiagnostic[] {
    const rows = this.database.connection
      .prepare(
        `SELECT code, severity, stage, page_id, revision_id, element_id, material_type, safe_message
         FROM runtime_diagnostics
         WHERE project_id = ? AND page_id = ? AND revision_id = ? ORDER BY id`,
      )
      .all(projectId, pageId, revisionId) as DiagnosticRow[];
    return rows.map((row) => ({
      code: row.code,
      severity: row.severity,
      stage: row.stage,
      pageId: row.page_id,
      revisionId: row.revision_id,
      ...(row.element_id ? { elementId: row.element_id } : {}),
      ...(row.material_type ? { materialType: row.material_type } : {}),
      safeMessage: row.safe_message,
    }));
  }

  getLastKnownGood(projectId: string, pageId: string): string | undefined {
    const row = this.database.connection
      .prepare(
        'SELECT last_known_good_revision_id FROM page_runtime_state WHERE project_id = ? AND page_id = ?',
      )
      .get(projectId, pageId) as { last_known_good_revision_id: string | null } | undefined;
    return row?.last_known_good_revision_id ?? undefined;
  }

  setLastKnownGood(projectId: string, pageId: string, revisionId: string, updatedAt: string): void {
    this.database.connection
      .prepare(
        `INSERT INTO page_runtime_state (
          project_id, page_id, last_known_good_revision_id, updated_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(project_id, page_id) DO UPDATE SET
          last_known_good_revision_id = excluded.last_known_good_revision_id,
          updated_at = excluded.updated_at`,
      )
      .run(projectId, pageId, revisionId, updatedAt);
  }
}
