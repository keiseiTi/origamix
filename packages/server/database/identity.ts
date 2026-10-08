import { eq } from 'drizzle-orm';
import { notFound } from '../errors';
import type { DatabaseClient } from './database';
import { agentRuns, pages, projects } from './schema';

export const encodeDatabaseId = (kind: 'conversation' | 'message', id: number): string =>
  `${kind}_${id}`;

export const decodeDatabaseId = (kind: 'conversation' | 'message', value: string): number => {
  const match = new RegExp(`^${kind}_([1-9][0-9]*)$`).exec(value);
  const id = match ? Number(match[1]) : NaN;
  if (!Number.isSafeInteger(id)) throw notFound(`${kind} 不存在`);
  return id;
};

export const projectKey = (client: DatabaseClient, projectId: string): number => {
  const row = client
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.projectId, projectId))
    .get();
  if (!row) throw notFound('项目不存在');
  return row.id;
};

export const pageKey = (client: DatabaseClient, pageId: string): number => {
  const row = client.select({ id: pages.id }).from(pages).where(eq(pages.pageId, pageId)).get();
  if (!row) throw notFound('页面不存在');
  return row.id;
};

export const runKey = (client: DatabaseClient, runId: string): number => {
  const row = client
    .select({ id: agentRuns.id })
    .from(agentRuns)
    .where(eq(agentRuns.runId, runId))
    .get();
  if (!row) throw notFound('Agent Run 不存在');
  return row.id;
};

export const projectPublicId = (client: DatabaseClient, id: number): string => {
  const row = client
    .select({ projectId: projects.projectId })
    .from(projects)
    .where(eq(projects.id, id))
    .get();
  if (!row) throw notFound('项目不存在');
  return row.projectId;
};

export const pagePublicId = (client: DatabaseClient, id: number): string => {
  const row = client.select({ pageId: pages.pageId }).from(pages).where(eq(pages.id, id)).get();
  if (!row) throw notFound('页面不存在');
  return row.pageId;
};

export const runPublicId = (client: DatabaseClient, id: number): string => {
  const row = client
    .select({ runId: agentRuns.runId })
    .from(agentRuns)
    .where(eq(agentRuns.id, id))
    .get();
  if (!row) throw notFound('Agent Run 不存在');
  return row.runId;
};
