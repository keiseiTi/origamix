import { eq } from 'drizzle-orm';
import type { WorkspaceRecord } from '@origamix/shared/protocol/api';
import type { ApplicationDatabase, DatabaseClient } from '../database/database';
import { workspaceState } from '../database/schema';

export class WorkspaceRepository {
  private readonly client: DatabaseClient;
  constructor(database: ApplicationDatabase | DatabaseClient) {
    this.client = 'orm' in database ? database.orm : database;
  }
  get(): WorkspaceRecord {
    const row = this.client.select().from(workspaceState).where(eq(workspaceState.id, 1)).get();
    if (!row) throw new Error('工作区状态未初始化');
    if (row.theme !== 'light' && row.theme !== 'dark') throw new Error('工作区主题无效');
    return {
      theme: row.theme,
      sidebarCollapsed: row.sidebarState === 'collapsed',
      updatedAt: row.updatedAt,
    };
  }
  save(input: Partial<Omit<WorkspaceRecord, 'updatedAt'>>): WorkspaceRecord {
    const next = { ...this.get(), ...input, updatedAt: new Date().toISOString() };
    this.client
      .update(workspaceState)
      .set({
        theme: next.theme,
        sidebarState: next.sidebarCollapsed ? 'collapsed' : 'expanded',
        updatedAt: next.updatedAt,
      })
      .where(eq(workspaceState.id, 1))
      .run();
    return next;
  }
}
