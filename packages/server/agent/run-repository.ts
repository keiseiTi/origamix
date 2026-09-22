import { and, asc, eq, inArray, notInArray } from 'drizzle-orm';
import { Value } from '@sinclair/typebox/value';
import {
  AgentRunStatusSchema,
  AgentRunKindSchema,
  PageAgentOutcomeSchema,
  RunBudgetSchema,
  type AgentRunStatus,
  type RunBudget,
  type AgentRunKind,
  type PageAgentOutcome,
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
  baseWorkingVersion: number;
  resultWorkingVersion?: number;
  resultWorkingHash?: string;
  modelRef: string;
  runKind: AgentRunKind;
  outcome?: PageAgentOutcome;
  outcomeJson?: unknown;
  repairAttempts: number;
  operationCount?: number;
  operationDigest?: string;
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
  failureStage?: string;
  recoveredCommit: boolean;
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
  if (!Value.Check(AgentRunStatusSchema, status) || !Value.Check(AgentRunKindSchema, row.runKind))
    throw new Error(`Agent Run ${row.id} 的状态或类型无效`);
  if (row.outcome !== null && !Value.Check(PageAgentOutcomeSchema, row.outcome))
    throw new Error(`Agent Run ${row.id} 的 Outcome 无效`);
  let outcomeJson: unknown;
  if (row.outcomeJson !== null) {
    try {
      outcomeJson = JSON.parse(row.outcomeJson);
    } catch {
      throw new Error(`Agent Run ${row.id} 的 outcome_json 不是合法 JSON`);
    }
  }
  return {
    id: row.id,
    projectId: row.projectId,
    pageId: row.pageId,
    conversationId: row.conversationId,
    userMessageId: row.userMessageId,
    clientRequestId: row.clientRequestId,
    baseWorkingVersion: row.baseWorkingVersion,
    ...(row.resultWorkingVersion === null
      ? {}
      : { resultWorkingVersion: row.resultWorkingVersion }),
    ...(row.resultWorkingHash === null ? {} : { resultWorkingHash: row.resultWorkingHash }),
    modelRef: row.modelRef,
    runKind: row.runKind as AgentRunKind,
    ...(row.outcome === null ? {} : { outcome: row.outcome as PageAgentOutcome }),
    ...(row.outcomeJson === null ? {} : { outcomeJson }),
    repairAttempts: row.repairAttempts,
    ...(row.operationCount === null ? {} : { operationCount: row.operationCount }),
    ...(row.operationDigest === null ? {} : { operationDigest: row.operationDigest }),
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
    ...(row.failureStage ? { failureStage: row.failureStage } : {}),
    recoveredCommit: row.recoveredCommit === 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(row.finishedAt ? { finishedAt: row.finishedAt } : {}),
  };
};

const toRow = (run: AgentRunRecord): typeof agentRuns.$inferInsert => ({
  ...run,
  status: agentRunStatus.encode(run.status),
  budgetJson: JSON.stringify(run.budget),
  resultWorkingVersion: run.resultWorkingVersion ?? null,
  resultWorkingHash: run.resultWorkingHash ?? null,
  outcome: run.outcome ?? null,
  outcomeJson: run.outcomeJson === undefined ? null : JSON.stringify(run.outcomeJson),
  operationCount: run.operationCount ?? null,
  operationDigest: run.operationDigest ?? null,
  retryOfRunId: run.retryOfRunId ?? null,
  durationMs: run.durationMs ?? null,
  errorCode: run.errorCode ?? null,
  errorMessage: run.errorMessage ?? null,
  failureStage: run.failureStage ?? null,
  recoveredCommit: run.recoveredCommit ? 1 : 0,
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
  listAll(): AgentRunRecord[] {
    return this.client
      .select()
      .from(agentRuns)
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
      resultWorkingVersion?: number;
      resultWorkingHash?: string;
      errorCode?: string;
      errorMessage?: string;
      durationMs?: number;
      outcome?: PageAgentOutcome;
      outcomeJson?: unknown;
      repairAttempts?: number;
      operationCount?: number;
      operationDigest?: string;
      failureStage?: string;
      recoveredCommit?: boolean;
    },
  ): boolean {
    if (expected.length === 0) return false;
    const values = {
      status: agentRunStatus.encode(patch.status),
      updatedAt: patch.updatedAt,
      ...(patch.finishedAt ? { finishedAt: patch.finishedAt } : {}),
      ...(patch.resultWorkingVersion === undefined
        ? {}
        : { resultWorkingVersion: patch.resultWorkingVersion }),
      ...(patch.resultWorkingHash === undefined
        ? {}
        : { resultWorkingHash: patch.resultWorkingHash }),
      errorCode: patch.errorCode ?? null,
      errorMessage: patch.errorMessage ?? null,
      ...(patch.durationMs === undefined ? {} : { durationMs: patch.durationMs }),
      ...(patch.outcome === undefined ? {} : { outcome: patch.outcome }),
      ...(patch.outcomeJson === undefined
        ? {}
        : { outcomeJson: JSON.stringify(patch.outcomeJson) }),
      ...(patch.repairAttempts === undefined ? {} : { repairAttempts: patch.repairAttempts }),
      ...(patch.operationCount === undefined ? {} : { operationCount: patch.operationCount }),
      ...(patch.operationDigest === undefined ? {} : { operationDigest: patch.operationDigest }),
      ...(patch.failureStage === undefined ? {} : { failureStage: patch.failureStage }),
      ...(patch.recoveredCommit === undefined
        ? {}
        : { recoveredCommit: patch.recoveredCommit ? 1 : 0 }),
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
