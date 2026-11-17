import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

export interface ProjectRow {
  id: string;
  code: string;
  configuration: string;
  created_at: string;
}

export interface PageRow {
  id: string;
  project_id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export class MysqlProjectRepository {
  constructor(private readonly sql: Pool | PoolConnection) {}

  async lockProject(id: string): Promise<ProjectRow | undefined> {
    const [rows] = await this.sql.execute<(RowDataPacket & ProjectRow)[]>(
      'SELECT * FROM origamix_web_projects WHERE id = ? FOR UPDATE',
      [id],
    );
    return rows[0];
  }

  async listProjects(): Promise<ProjectRow[]> {
    const [rows] = await this.sql.query<(RowDataPacket & ProjectRow)[]>(
      'SELECT * FROM origamix_web_projects ORDER BY created_at, id',
    );
    return rows;
  }

  async listPages(projectId?: string): Promise<PageRow[]> {
    const filter = projectId ? ' WHERE project_id = ?' : '';
    const [rows] = await this.sql.execute<(RowDataPacket & PageRow)[]>(
      `SELECT * FROM origamix_web_pages${filter} ORDER BY created_at, id`,
      projectId ? [projectId] : [],
    );
    return rows;
  }

  insertProject(row: ProjectRow) {
    return this.sql.execute(
      'INSERT INTO origamix_web_projects (id, code, configuration, created_at) VALUES (?, ?, ?, ?)',
      [row.id, row.code, row.configuration, row.created_at],
    );
  }

  writeConfiguration(projectId: string, document: string) {
    return this.sql.execute('UPDATE origamix_web_projects SET configuration = ? WHERE id = ?', [
      document,
      projectId,
    ]);
  }

  insertPage(row: PageRow) {
    return this.sql.execute(
      'INSERT INTO origamix_web_pages (id, project_id, name, slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [row.id, row.project_id, row.name, row.slug, row.created_at, row.updated_at],
    );
  }

  async updatePageName(page: PageRow, name: string): Promise<PageRow> {
    const updated_at = new Date().toISOString();
    await this.sql.execute(
      'UPDATE origamix_web_pages SET name = ?, updated_at = ? WHERE project_id = ? AND id = ?',
      [name, updated_at, page.project_id, page.id],
    );
    return { ...page, name, updated_at };
  }

  async readRoleRequest(projectId: string, requestId: string): Promise<string | undefined> {
    const [rows] = await this.sql.execute<(RowDataPacket & { digest: string })[]>(
      'SELECT digest FROM origamix_web_role_requests WHERE project_id = ? AND request_id = ?',
      [projectId, requestId],
    );
    return rows[0]?.digest;
  }

  recordRoleRequest(projectId: string, requestId: string, digest: string) {
    return this.sql.execute(
      'INSERT INTO origamix_web_role_requests (project_id, request_id, digest) VALUES (?, ?, ?)',
      [projectId, requestId, digest],
    );
  }

  deletePage(projectId: string, pageId: string) {
    return this.sql.execute('DELETE FROM origamix_web_pages WHERE project_id = ? AND id = ?', [
      projectId,
      pageId,
    ]);
  }

  /** Caller owns the project lock and transaction. */
  async deleteProject(projectId: string): Promise<void> {
    await this.sql.execute('DELETE FROM origamix_web_role_requests WHERE project_id = ?', [
      projectId,
    ]);
    await this.sql.execute('DELETE FROM origamix_web_schema_records WHERE project_id = ?', [
      projectId,
    ]);
    await this.sql.execute('DELETE FROM origamix_web_pages WHERE project_id = ?', [projectId]);
    await this.sql.execute('DELETE FROM origamix_web_projects WHERE id = ?', [projectId]);
  }
}
