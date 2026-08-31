import type { ApplicationDatabase } from '../database/database';
import type { PageRecord, ProjectRecord } from '@origamix/shared/protocol/api';

type ProjectRow = {
  id: string;
  path: string;
  name: string;
  format_version: string;
  status: string;
  created_at: string;
  last_opened_at: string;
};
type PageRow = {
  id: string;
  project_id: string;
  slug: string;
  name: string;
  relative_path: string;
  status: string;
  created_at: string;
  updated_at: string;
};
const projectRecord = (row: ProjectRow): ProjectRecord => ({
  id: row.id,
  path: row.path,
  name: row.name,
  formatVersion: row.format_version,
  status: row.status,
  createdAt: row.created_at,
  lastOpenedAt: row.last_opened_at
});
const pageRecord = (row: PageRow): PageRecord => ({
  id: row.id,
  projectId: row.project_id,
  slug: row.slug,
  name: row.name,
  relativePath: row.relative_path,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export class ProjectRepository {
  constructor(private readonly database: ApplicationDatabase) {}

  listProjects(): ProjectRecord[] {
    return (
      this.database.connection
        .prepare('SELECT * FROM projects WHERE status = ? ORDER BY last_opened_at DESC')
        .all('available') as ProjectRow[]
    ).map(projectRecord);
  }

  getProject(id: string): ProjectRecord | undefined {
    const row = this.database.connection.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
      ProjectRow | undefined;
    return row && projectRecord(row);
  }

  getPage(projectId: string, pageId: string): PageRecord | undefined {
    const row = this.database.connection
      .prepare('SELECT * FROM pages WHERE project_id = ? AND id = ? AND status = ?')
      .get(projectId, pageId, 'active') as PageRow | undefined;
    return row && pageRecord(row);
  }

  listPages(projectId: string): PageRecord[] {
    return (
      this.database.connection
        .prepare('SELECT * FROM pages WHERE project_id = ? AND status = ? ORDER BY created_at')
        .all(projectId, 'active') as PageRow[]
    ).map(pageRecord);
  }

  reconcile(project: ProjectRecord, pages: PageRecord[]): void {
    const db = this.database.connection;
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(
        'INSERT INTO projects (id, path, name, format_version, status, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET path = excluded.path, name = excluded.name, format_version = excluded.format_version, status = excluded.status, last_opened_at = excluded.last_opened_at'
      ).run(
        project.id,
        project.path,
        project.name,
        project.formatVersion,
        project.status,
        project.createdAt,
        project.lastOpenedAt
      );
      const upsertPage = db.prepare(
        'INSERT INTO pages (id, project_id, slug, name, relative_path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, relative_path = excluded.relative_path, status = excluded.status, updated_at = excluded.updated_at'
      );
      for (const page of pages)
        upsertPage.run(
          page.id,
          page.projectId,
          page.slug,
          page.name,
          page.relativePath,
          page.status,
          page.createdAt,
          page.updatedAt
        );
      const ids = pages.map((page) => page.id);
      if (ids.length)
        db.prepare(
          `UPDATE pages SET status = 'missing', updated_at = ? WHERE project_id = ? AND id NOT IN (${ids.map(() => '?').join(', ')})`
        ).run(new Date().toISOString(), project.id, ...ids);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
