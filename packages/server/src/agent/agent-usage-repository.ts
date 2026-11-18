import { and, eq, gte } from 'drizzle-orm';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { AgentUsageScope } from '@origamix/shared';
import type { ApplicationDatabase } from '../database/database';
import { agentRuns, pages, projects } from '../database/schema';
import { agentRunStatus } from '../database/status-codecs';

export interface ReportedUsage {
  reportedInputTokens: number;
  reportedOutputTokens: number;
  fullyReportedCalls: number;
}

interface UsageRun extends AgentUsageScope, ReportedUsage {
  createdAt: string;
  modelCalls: number;
  interrupted: boolean;
}

export interface AgentUsageRepository {
  record(runId: string, usage: ReportedUsage, modelCalls: number): Promise<void> | void;
  list(scope?: AgentUsageScope, earliest?: string): Promise<UsageRun[]> | UsageRun[];
}

export const sqliteAgentUsage = (database: ApplicationDatabase): AgentUsageRepository => ({
  record: (runId, usage, modelCalls) => {
    database.orm
      .update(agentRuns)
      .set({ ...usage, modelCalls })
      .where(eq(agentRuns.runId, runId))
      .run();
  },
  list: (scope, earliest) =>
    database.orm
      .select({
        projectId: projects.projectId,
        pageId: pages.pageId,
        createdAt: agentRuns.createdAt,
        modelCalls: agentRuns.modelCalls,
        status: agentRuns.status,
        reportedInputTokens: agentRuns.reportedInputTokens,
        reportedOutputTokens: agentRuns.reportedOutputTokens,
        fullyReportedCalls: agentRuns.fullyReportedCalls,
      })
      .from(agentRuns)
      .innerJoin(projects, eq(projects.id, agentRuns.projectId))
      .innerJoin(pages, and(eq(pages.id, agentRuns.pageId), eq(pages.projectId, projects.id)))
      .where(
        and(
          scope ? eq(projects.projectId, scope.projectId) : undefined,
          scope ? eq(pages.pageId, scope.pageId) : undefined,
          earliest ? gte(agentRuns.createdAt, earliest) : undefined,
        ),
      )
      .all()
      .map(({ status, ...row }) => ({
        ...row,
        interrupted: status === agentRunStatus.encode('interrupted'),
      })),
});

interface MysqlUsageDocument extends Partial<ReportedUsage> {
  createdAt: string;
  modelCalls: number;
}

export const mysqlAgentUsage = (pool: Pool): AgentUsageRepository => ({
  record: async (runId, usage, modelCalls) => {
    await pool.execute(
      'UPDATE origamix_web_agent_runs SET document = JSON_MERGE_PATCH(document, ?) WHERE id = ?',
      [JSON.stringify({ ...usage, modelCalls }), runId],
    );
  },
  list: async (scope, earliest) => {
    const conditions = [];
    const values = [];
    if (scope) {
      conditions.push('project_id = ? AND page_id = ?');
      values.push(scope.projectId, scope.pageId);
    }
    if (earliest) {
      conditions.push("JSON_UNQUOTE(JSON_EXTRACT(document, '$.createdAt')) >= ?");
      values.push(earliest);
    }
    const [rows] = await pool.execute<
      (RowDataPacket & AgentUsageScope & { status: string; usage_document: string })[]
    >(
      `SELECT project_id AS projectId, page_id AS pageId, status,
        JSON_OBJECT(
          'createdAt', JSON_EXTRACT(document, '$.createdAt'),
          'modelCalls', JSON_EXTRACT(document, '$.modelCalls'),
          'reportedInputTokens', JSON_EXTRACT(document, '$.reportedInputTokens'),
          'reportedOutputTokens', JSON_EXTRACT(document, '$.reportedOutputTokens'),
          'fullyReportedCalls', JSON_EXTRACT(document, '$.fullyReportedCalls')
        ) AS usage_document
        FROM origamix_web_agent_runs WHERE ${conditions.join(' AND ') || '1 = 1'}`,
      values,
    );
    return rows.map(({ projectId, pageId, status, usage_document }) => {
      const document = JSON.parse(usage_document) as MysqlUsageDocument;
      return {
        projectId,
        pageId,
        interrupted: status === 'interrupted',
        createdAt: document.createdAt,
        modelCalls: document.modelCalls,
        reportedInputTokens: document.reportedInputTokens ?? 0,
        reportedOutputTokens: document.reportedOutputTokens ?? 0,
        fullyReportedCalls: document.fullyReportedCalls ?? 0,
      };
    });
  },
});
