import type { ApplicationDatabase } from '../database/database';
import type { WorkspaceRecord } from '@origamix/shared/protocol/api';

export class WorkspaceRepository {
  constructor(private readonly database: ApplicationDatabase) {}

  get(): WorkspaceRecord {
    const row = this.database.connection
      .prepare('SELECT * FROM workspace_state WHERE id = 1')
      .get() as {
      active_project_id: string | null;
      active_page_id: string | null;
      theme: 'light' | 'dark';
      sidebar_state: 'expanded' | 'collapsed';
      updated_at: string;
    };
    return {
      activeProjectId: row.active_project_id,
      activePageId: row.active_page_id,
      theme: row.theme,
      sidebarCollapsed: row.sidebar_state === 'collapsed',
      updatedAt: row.updated_at
    };
  }

  save(input: Partial<Omit<WorkspaceRecord, 'updatedAt'>>): WorkspaceRecord {
    const current = this.get();
    const next = { ...current, ...input, updatedAt: new Date().toISOString() };
    this.database.connection
      .prepare(
        'UPDATE workspace_state SET active_project_id = ?, active_page_id = ?, theme = ?, sidebar_state = ?, updated_at = ? WHERE id = 1'
      )
      .run(
        next.activeProjectId,
        next.activePageId,
        next.theme,
        next.sidebarCollapsed ? 'collapsed' : 'expanded',
        next.updatedAt
      );
    return next;
  }
}
