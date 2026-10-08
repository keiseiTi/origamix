import { and, asc, desc, eq, inArray, notInArray, notInArray as notIn } from 'drizzle-orm';
import type { PageRecord, ProjectRecord } from '@origamix/shared/protocol/api';
import type { ApplicationDatabase, DatabaseClient } from '../database/database';
import {
  agentRuns,
  agentToolAudits,
  conversations,
  messages,
  pages,
  projects,
} from '../database/schema';
import { pageKey, projectKey, projectPublicId } from '../database/identity';
import { agentRunStatus } from '../database/status';

const projectRecord = (row: typeof projects.$inferSelect): ProjectRecord => ({
  id: row.projectId,
  path: row.path,
  name: row.name,
  status: row.status,
  createdAt: row.createdAt,
  lastOpenedAt: row.lastOpenedAt,
});
const pageRecord = (row: typeof pages.$inferSelect, client: DatabaseClient): PageRecord => ({
  id: row.pageId,
  projectId: projectPublicId(client, row.projectId),
  slug: row.slug,
  name: row.name,
  relativePath: row.relativePath,
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
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
    const row = this.client.select().from(projects).where(eq(projects.projectId, id)).get();
    return row && projectRecord(row);
  }
  getPage(projectId: string, pageId: string): PageRecord | undefined {
    const project = this.client
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.projectId, projectId))
      .get();
    if (!project) return undefined;
    const row = this.client
      .select()
      .from(pages)
      .where(and(eq(pages.projectId, project.id), eq(pages.pageId, pageId), eq(pages.status, 0)))
      .get();
    return row && pageRecord(row, this.client);
  }
  listPages(projectId: string): PageRecord[] {
    return this.client
      .select()
      .from(pages)
      .where(and(eq(pages.projectId, projectKey(this.client, projectId)), eq(pages.status, 0)))
      .orderBy(asc(pages.createdAt))
      .all()
      .map((row) => pageRecord(row, this.client));
  }
  hasActiveRuns(projectId: string, pageId?: string): boolean {
    return Boolean(
      this.client
        .select({ id: agentRuns.id })
        .from(agentRuns)
        .where(
          and(
            eq(agentRuns.projectId, projectKey(this.client, projectId)),
            ...(pageId ? [eq(agentRuns.pageId, pageKey(this.client, pageId))] : []),
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
          .where(and(eq(pages.projectId, projectKey(client, projectId)), eq(pages.pageId, pageId)))
          .get()
      )
        return false;
      const conversationIds = client
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.projectId, projectKey(client, projectId)),
            eq(conversations.pageId, pageKey(client, pageId)),
          ),
        )
        .all()
        .map(({ id }) => id);
      const runIds = client
        .select({ id: agentRuns.id })
        .from(agentRuns)
        .where(
          and(
            eq(agentRuns.projectId, projectKey(client, projectId)),
            eq(agentRuns.pageId, pageKey(client, pageId)),
          ),
        )
        .all()
        .map(({ id }) => id);
      if (runIds.length)
        client.delete(agentToolAudits).where(inArray(agentToolAudits.runId, runIds)).run();
      client
        .delete(agentRuns)
        .where(
          and(
            eq(agentRuns.projectId, projectKey(client, projectId)),
            eq(agentRuns.pageId, pageKey(client, pageId)),
          ),
        )
        .run();
      if (conversationIds.length)
        client.delete(messages).where(inArray(messages.conversationId, conversationIds)).run();
      client
        .delete(conversations)
        .where(
          and(
            eq(conversations.projectId, projectKey(client, projectId)),
            eq(conversations.pageId, pageKey(client, pageId)),
          ),
        )
        .run();
      client
        .delete(pages)
        .where(and(eq(pages.projectId, projectKey(client, projectId)), eq(pages.pageId, pageId)))
        .run();
      return true;
    });
  }
  deleteProjectRecord(projectId: string): boolean {
    return this.transact((client) => {
      if (
        !client
          .select({ id: projects.id })
          .from(projects)
          .where(eq(projects.projectId, projectId))
          .get()
      )
        return false;
      const conversationIds = client
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.projectId, projectKey(client, projectId)))
        .all()
        .map(({ id }) => id);
      const runIds = client
        .select({ id: agentRuns.id })
        .from(agentRuns)
        .where(eq(agentRuns.projectId, projectKey(client, projectId)))
        .all()
        .map(({ id }) => id);
      if (runIds.length)
        client.delete(agentToolAudits).where(inArray(agentToolAudits.runId, runIds)).run();
      client
        .delete(agentRuns)
        .where(eq(agentRuns.projectId, projectKey(client, projectId)))
        .run();
      if (conversationIds.length)
        client.delete(messages).where(inArray(messages.conversationId, conversationIds)).run();
      client
        .delete(conversations)
        .where(eq(conversations.projectId, projectKey(client, projectId)))
        .run();
      client
        .delete(pages)
        .where(eq(pages.projectId, projectKey(client, projectId)))
        .run();
      client.delete(projects).where(eq(projects.projectId, projectId)).run();
      return true;
    });
  }
  reconcile(project: ProjectRecord, pageRecords: PageRecord[]): void {
    this.transact((client) => {
      client
        .insert(projects)
        .values({ ...project, id: undefined, projectId: project.id })
        .onConflictDoUpdate({
          target: projects.projectId,
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
          .values({
            ...page,
            id: undefined,
            pageId: page.id,
            projectId: projectKey(client, page.projectId),
          })
          .onConflictDoUpdate({
            target: pages.pageId,
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
        .where(
          and(
            eq(pages.projectId, projectKey(client, project.id)),
            ...(ids.length ? [notIn(pages.pageId, ids)] : []),
          ),
        )
        .run();
    });
  }
}
