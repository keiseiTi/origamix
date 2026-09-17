import { and, asc, eq, inArray, notInArray } from 'drizzle-orm';
import { Value } from '@sinclair/typebox/value';
import {
  AgentRunStatusSchema,
  RunModeSchema,
  RunBudgetSchema,
  type AgentRunStatus,
  type RunBudget,
  type RunMode,
} from '@origamix/shared/protocol/agent';
import type { ApplicationDatabase, DatabaseClient } from '../database/database';
import { agentRuns } from '../database/schema';
import { agentRunStatus } from '../database/status';

export interface AgentRunRecord {
  id: string;
  projectId: string;
  pageId: string;
  conversationId: string;
  userMessageId: string;
  clientRequestId: string;
  baseRevisionId: string;
  baseWorkingVersion: number;
  resultRevisionId?: string;
  resultWorkingVersion?: number;
  modelRef: string;
  mode: RunMode;
  status: AgentRunStatus;
  budget: RunBudget;
  promptVersion: string;
  policyVersion: string;
  toolsetVersion: string;
  materialManifestVersion: string;
  retryOfRunId?: string;
  inputTokens: number;
  outputTokens: number;
  modelCalls: number;
  toolCalls: number;
  durationMs?: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
}

type RunRow = typeof agentRuns.$inferSelect;
const fromRow = (row: RunRow): AgentRunRecord => {
  let budget: unknown;
  try {
    budget = JSON.parse(row.budgetJson);
  } catch {
    throw new Error(`Agent Run ${row.id} 的 budget_json 不是合法 JSON`);
  }
  if (!Value.Check(RunBudgetSchema, budget)) throw new Error(`Agent Run ${row.id} 的 budget 无效`);
  const status = agentRunStatus.decode(row.status);
  if (!Value.Check(AgentRunStatusSchema, status) || !Value.Check(RunModeSchema, row.mode))
    throw new Error(`Agent Run ${row.id} 的状态或模式无效`);
  return {
    id: row.id,
    projectId: row.projectId,
    pageId: row.pageId,
    conversationId: row.conversationId,
    userMessageId: row.userMessageId,
    clientRequestId: row.clientRequestId,
    baseRevisionId: row.baseRevisionId,
    baseWorkingVersion: row.baseWorkingVersion,
    ...(row.resultRevisionId ? { resultRevisionId: row.resultRevisionId } : {}),
    ...(row.resultWorkingVersion === null
      ? {}
      : { resultWorkingVersion: row.resultWorkingVersion }),
    modelRef: row.modelRef,
    mode: row.mode as RunMode,
    status,
    budget: budget as RunBudget,
    promptVersion: row.promptVersion,
    policyVersion: row.policyVersion,
    toolsetVersion: row.toolsetVersion,
    materialManifestVersion: row.materialManifestVersion,
    ...(row.retryOfRunId ? { retryOfRunId: row.retryOfRunId } : {}),
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    modelCalls: row.modelCalls,
    toolCalls: row.toolCalls,
    ...(row.durationMs === null ? {} : { durationMs: row.durationMs }),
    ...(row.errorCode ? { errorCode: row.errorCode } : {}),
    ...(row.errorMessage ? { errorMessage: row.errorMessage } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row.finishedAt ? { finishedAt: row.finishedAt } : {}),
  };
};

const toRow = (run: AgentRunRecord): typeof agentRuns.$inferInsert => ({
  ...run,
  status: agentRunStatus.encode(run.status),
  budgetJson: JSON.stringify(run.budget),
  resultRevisionId: run.resultRevisionId ?? null,
  resultWorkingVersion: run.resultWorkingVersion ?? null,
  retryOfRunId: run.retryOfRunId ?? null,
  durationMs: run.durationMs ?? null,
  errorCode: run.errorCode ?? null,
  errorMessage: run.errorMessage ?? null,
  finishedAt: run.finishedAt ?? null,
});

export class AgentRunRepository {
  private readonly client: DatabaseClient;
  constructor(database: ApplicationDatabase | DatabaseClient) {
    this.client = 'orm' in database ? database.orm : database;
  }
  create(run: AgentRunRecord): AgentRunRecord {
    this.client.insert(agentRuns).values(toRow(run)).run();
    return run;
  }
  get(id: string): AgentRunRecord | undefined {
    const row = this.client.select().from(agentRuns).where(eq(agentRuns.id, id)).get();
    return row && fromRow(row);
  }
  findByClientRequest(
    projectId: string,
    pageId: string,
    clientRequestId: string,
  ): AgentRunRecord | undefined {
    const row = this.client
      .select()
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.projectId, projectId),
          eq(agentRuns.pageId, pageId),
          eq(agentRuns.clientRequestId, clientRequestId),
        ),
      )
      .get();
    return row && fromRow(row);
  }
  listActive(): AgentRunRecord[] {
    return this.client
      .select()
      .from(agentRuns)
      .where(
        notInArray(
          agentRuns.status,
          ['completed', 'failed', 'cancelled', 'interrupted'].map((status) =>
            agentRunStatus.encode(status as AgentRunStatus),
          ),
        ),
      )
      .orderBy(asc(agentRuns.createdAt))
      .all()
      .map(fromRow);
  }
  updateStatus(
    id: string,
    expected: readonly AgentRunStatus[],
    patch: {
      status: AgentRunStatus;
      updatedAt: string;
      finishedAt?: string;
      resultRevisionId?: string;
      resultWorkingVersion?: number;
      errorCode?: string;
      errorMessage?: string;
      durationMs?: number;
    },
  ): boolean {
    if (expected.length === 0) return false;
    const values = {
      status: agentRunStatus.encode(patch.status),
      updatedAt: patch.updatedAt,
      ...(patch.finishedAt ? { finishedAt: patch.finishedAt } : {}),
      ...(patch.resultRevisionId ? { resultRevisionId: patch.resultRevisionId } : {}),
      ...(patch.resultWorkingVersion === undefined
        ? {}
        : { resultWorkingVersion: patch.resultWorkingVersion }),
      errorCode: patch.errorCode ?? null,
      errorMessage: patch.errorMessage ?? null,
      ...(patch.durationMs === undefined ? {} : { durationMs: patch.durationMs }),
    };
    return (
      this.client
        .update(agentRuns)
        .set(values)
        .where(
          and(eq(agentRuns.id, id), inArray(agentRuns.status, expected.map(agentRunStatus.encode))),
        )
        .run().changes > 0
    );
  }
  updateMetrics(
    id: string,
    metrics: {
      inputTokens: number;
      outputTokens: number;
      modelCalls: number;
      toolCalls: number;
      durationMs: number;
    },
  ): boolean {
    return (
      this.client
        .update(agentRuns)
        .set({ ...metrics, updatedAt: new Date().toISOString() })
        .where(eq(agentRuns.id, id))
        .run().changes > 0
    );
  }
}
