import { and, asc, desc, eq, inArray, notInArray, notInArray as notIn } from 'drizzle-orm';
import type { PageRecord, ProjectRecord } from '@origamix/shared/protocol/api';
import type { ApplicationDatabase, DatabaseClient } from '../database/database';
import { agentRuns, conversations, messages, pages, projects } from '../database/schema';
import { agentRunStatus } from '../database/status';

const projectRecord = (row: typeof projects.$inferSelect): ProjectRecord => ({ ...row });
const pageRecord = (row: typeof pages.$inferSelect): PageRecord => ({ ...row });
const terminal = ['completed', 'failed', 'cancelled', 'interrupted'].map((status) =>
  agentRunStatus.encode(status as Parameters<typeof agentRunStatus.encode>[0]),
);

export class ProjectRepository {
  private readonly client: DatabaseClient;
  private readonly database?: ApplicationDatabase;
  constructor(database: ApplicationDatabase | DatabaseClient) {
    this.client = 'orm' in database ? database.orm : database;
    this.database = 'orm' in database ? database : undefined;
  }
  private transact<T>(action: (client: DatabaseClient) => T): T {
    return this.database ? this.database.transaction(action) : action(this.client);
  }
  listProjects(): ProjectRecord[] {
    return this.client
      .select()
      .from(projects)
      .where(eq(projects.status, 0))
      .orderBy(desc(projects.lastOpenedAt))
      .all()
      .map(projectRecord);
  }
  getProject(id: string): ProjectRecord | undefined {
    const row = this.client.select().from(projects).where(eq(projects.id, id)).get();
    return row && projectRecord(row);
  }
  getPage(projectId: string, pageId: string): PageRecord | undefined {
    const row = this.client
      .select()
      .from(pages)
      .where(and(eq(pages.projectId, projectId), eq(pages.id, pageId), eq(pages.status, 0)))
      .get();
    return row && pageRecord(row);
  }
  listPages(projectId: string): PageRecord[] {
    return this.client
      .select()
      .from(pages)
      .where(and(eq(pages.projectId, projectId), eq(pages.status, 0)))
      .orderBy(asc(pages.createdAt))
      .all()
      .map(pageRecord);
  }
  hasActiveRuns(projectId: string, pageId?: string): boolean {
    return Boolean(
      this.client
        .select({ id: agentRuns.id })
        .from(agentRuns)
        .where(
          and(
            eq(agentRuns.projectId, projectId),
            ...(pageId ? [eq(agentRuns.pageId, pageId)] : []),
            notInArray(agentRuns.status, terminal),
          ),
        )
        .limit(1)
        .get(),
    );
  }
  deletePageRecord(projectId: string, pageId: string): boolean {
    return this.transact((client) => {
      if (
        !client
          .select({ id: pages.id })
          .from(pages)
          .where(and(eq(pages.projectId, projectId), eq(pages.id, pageId)))
          .get()
      )
        return false;
      const conversationIds = client
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(eq(conversations.projectId, projectId), eq(conversations.pageId, pageId)))
        .all()
        .map(({ id }) => id);
      client
        .delete(agentRuns)
        .where(and(eq(agentRuns.projectId, projectId), eq(agentRuns.pageId, pageId)))
        .run();
      if (conversationIds.length)
        client.delete(messages).where(inArray(messages.conversationId, conversationIds)).run();
      client
        .delete(conversations)
        .where(and(eq(conversations.projectId, projectId), eq(conversations.pageId, pageId)))
        .run();
      client
        .delete(pages)
        .where(and(eq(pages.projectId, projectId), eq(pages.id, pageId)))
        .run();
      return true;
    });
  }
  deleteProjectRecord(projectId: string): boolean {
    return this.transact((client) => {
      if (
        !client.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).get()
      )
        return false;
      const conversationIds = client
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.projectId, projectId))
        .all()
        .map(({ id }) => id);
      client.delete(agentRuns).where(eq(agentRuns.projectId, projectId)).run();
      if (conversationIds.length)
        client.delete(messages).where(inArray(messages.conversationId, conversationIds)).run();
      client.delete(conversations).where(eq(conversations.projectId, projectId)).run();
      client.delete(pages).where(eq(pages.projectId, projectId)).run();
      client.delete(projects).where(eq(projects.id, projectId)).run();
      return true;
    });
  }
  reconcile(project: ProjectRecord, pageRecords: PageRecord[]): void {
    this.transact((client) => {
      client
        .insert(projects)
        .values(project)
        .onConflictDoUpdate({
          target: projects.id,
          set: {
            path: project.path,
            name: project.name,
            status: project.status,
            lastOpenedAt: project.lastOpenedAt,
          },
        })
        .run();
      for (const page of pageRecords)
        client
          .insert(pages)
          .values(page)
          .onConflictDoUpdate({
            target: pages.id,
            set: {
              slug: page.slug,
              name: page.name,
              relativePath: page.relativePath,
              status: page.status,
              updatedAt: page.updatedAt,
            },
          })
          .run();
      const ids = pageRecords.map(({ id }) => id);
      client
        .update(pages)
        .set({ status: 1, updatedAt: new Date().toISOString() })
        .where(and(eq(pages.projectId, project.id), ...(ids.length ? [notIn(pages.id, ids)] : [])))
        .run();
    });
  }
}
