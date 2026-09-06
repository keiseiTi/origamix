import { Value } from '@sinclair/typebox/value';
import {
  AgentRunStatusSchema,
  RunModeSchema,
  RunBudgetSchema,
  type AgentRunStatus,
  type RunBudget,
  type RunMode,
} from '@origamix/shared/protocol/agent';
import type { ApplicationDatabase } from '../database/database';

export interface AgentRunRecord {
  id: string;
  projectId: string;
  pageId: string;
  conversationId: string;
  userMessageId: string;
  clientRequestId: string;
  baseRevisionId: string;
  resultRevisionId?: string;
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

type RunRow = {
  id: string;
  project_id: string;
  page_id: string;
  conversation_id: string;
  user_message_id: string | null;
  client_request_id: string | null;
  base_revision_id: string | null;
  result_revision_id: string | null;
  model_ref: string;
  mode: string;
  status: string;
  budget_json: string;
  prompt_version: string;
  policy_version: string;
  toolset_version: string;
  material_manifest_version: string;
  retry_of_run_id: string | null;
  input_tokens: number;
  output_tokens: number;
  model_calls: number;
  tool_calls: number;
  duration_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  revision_id: string | null;
  started_at: string;
  updated_at: string | null;
  finished_at: string | null;
};

function fromRow(row: RunRow): AgentRunRecord {
  let budget: unknown;
  try {
    budget = JSON.parse(row.budget_json);
  } catch {
    throw new Error(`Agent Run ${row.id} 的 budget_json 不是合法 JSON`);
  }
  if (!Value.Check(RunBudgetSchema, budget)) throw new Error(`Agent Run ${row.id} 的 budget 无效`);
  if (!Value.Check(AgentRunStatusSchema, row.status) || !Value.Check(RunModeSchema, row.mode)) {
    throw new Error(`Agent Run ${row.id} 的状态或模式无效`);
  }
  if (!row.user_message_id || !row.client_request_id || !row.base_revision_id) {
    throw new Error(`Agent Run ${row.id} 缺少版本 2 必填字段`);
  }
  return {
    id: row.id,
    projectId: row.project_id,
    pageId: row.page_id,
    conversationId: row.conversation_id,
    userMessageId: row.user_message_id,
    clientRequestId: row.client_request_id,
    baseRevisionId: row.base_revision_id,
    ...((row.result_revision_id ?? row.revision_id)
      ? { resultRevisionId: row.result_revision_id ?? row.revision_id ?? undefined }
      : {}),
    modelRef: row.model_ref,
    mode: row.mode as RunMode,
    status: row.status as AgentRunStatus,
    budget: budget as RunBudget,
    promptVersion: row.prompt_version,
    policyVersion: row.policy_version,
    toolsetVersion: row.toolset_version,
    materialManifestVersion: row.material_manifest_version,
    ...(row.retry_of_run_id ? { retryOfRunId: row.retry_of_run_id } : {}),
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    modelCalls: row.model_calls,
    toolCalls: row.tool_calls,
    ...(row.duration_ms === null ? {} : { durationMs: row.duration_ms }),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    ...(row.error_message ? { errorMessage: row.error_message } : {}),
    createdAt: row.started_at,
    updatedAt: row.updated_at ?? row.started_at,
    ...(row.finished_at ? { finishedAt: row.finished_at } : {}),
  };
}

export class AgentRunRepository {
  constructor(private readonly database: ApplicationDatabase) {}

  create(run: AgentRunRecord): AgentRunRecord {
    this.database.connection
      .prepare(
        `INSERT INTO agent_runs (
          id, project_id, page_id, conversation_id, user_message_id, client_request_id,
          base_revision_id, result_revision_id, model_ref, mode, status, budget_json,
          prompt_version, policy_version, toolset_version, material_manifest_version,
          retry_of_run_id, input_tokens, output_tokens, model_calls, tool_calls, duration_ms,
          error_code, error_message, revision_id, started_at, updated_at, finished_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        run.id,
        run.projectId,
        run.pageId,
        run.conversationId,
        run.userMessageId,
        run.clientRequestId,
        run.baseRevisionId,
        run.resultRevisionId ?? null,
        run.modelRef,
        run.mode,
        run.status,
        JSON.stringify(run.budget),
        run.promptVersion,
        run.policyVersion,
        run.toolsetVersion,
        run.materialManifestVersion,
        run.retryOfRunId ?? null,
        run.inputTokens,
        run.outputTokens,
        run.modelCalls,
        run.toolCalls,
        run.durationMs ?? null,
        run.errorCode ?? null,
        run.errorMessage ?? null,
        run.resultRevisionId ?? null,
        run.createdAt,
        run.updatedAt,
        run.finishedAt ?? null,
      );
    return run;
  }

  get(id: string): AgentRunRecord | undefined {
    const row = this.database.connection
      .prepare('SELECT * FROM agent_runs WHERE id = ?')
      .get(id) as RunRow | undefined;
    return row && fromRow(row);
  }

  findByClientRequest(
    projectId: string,
    pageId: string,
    clientRequestId: string,
  ): AgentRunRecord | undefined {
    const row = this.database.connection
      .prepare(
        'SELECT * FROM agent_runs WHERE project_id = ? AND page_id = ? AND client_request_id = ?',
      )
      .get(projectId, pageId, clientRequestId) as RunRow | undefined;
    return row && fromRow(row);
  }

  listActive(): AgentRunRecord[] {
    const terminal = ['completed', 'failed', 'cancelled', 'interrupted'];
    return (
      this.database.connection
        .prepare(
          `SELECT * FROM agent_runs WHERE status NOT IN (${terminal.map(() => '?').join(', ')}) ORDER BY started_at`,
        )
        .all(...terminal) as RunRow[]
    ).map(fromRow);
  }

  updateStatus(
    id: string,
    expected: readonly AgentRunStatus[],
    patch: {
      status: AgentRunStatus;
      updatedAt: string;
      finishedAt?: string;
      resultRevisionId?: string;
      errorCode?: string;
      errorMessage?: string;
      durationMs?: number;
    },
  ): boolean {
    if (expected.length === 0) return false;
    return (
      this.database.connection
        .prepare(
          `UPDATE agent_runs SET status = ?, updated_at = ?, finished_at = COALESCE(?, finished_at),
           result_revision_id = COALESCE(?, result_revision_id), revision_id = COALESCE(?, revision_id),
           error_code = ?, error_message = ?, duration_ms = COALESCE(?, duration_ms)
           WHERE id = ? AND status IN (${expected.map(() => '?').join(', ')})`,
        )
        .run(
          patch.status,
          patch.updatedAt,
          patch.finishedAt ?? null,
          patch.resultRevisionId ?? null,
          patch.resultRevisionId ?? null,
          patch.errorCode ?? null,
          patch.errorMessage ?? null,
          patch.durationMs ?? null,
          id,
          ...expected,
        ).changes > 0
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
      this.database.connection
        .prepare(
          `UPDATE agent_runs SET input_tokens = ?, output_tokens = ?, model_calls = ?,
         tool_calls = ?, duration_ms = ?, updated_at = ? WHERE id = ?`,
        )
        .run(
          metrics.inputTokens,
          metrics.outputTokens,
          metrics.modelCalls,
          metrics.toolCalls,
          metrics.durationMs,
          new Date().toISOString(),
          id,
        ).changes > 0
    );
  }
}
