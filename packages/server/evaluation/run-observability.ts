import type { PageAgentOutcome } from '@origamix/shared/protocol/agent';
import type { AgentRunRecord } from '../agent/run-repository';

export interface AgentRunObservability {
  totalRuns: number;
  outcomeCounts: Partial<Record<PageAgentOutcome, number>>;
  firstTerminalSuccessRate: number;
  repairRate: number;
  repairSuccessRate: number;
  missingTerminalDecisionRate: number;
  workingConflictRate: number;
  recoveredCommitCount: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p50ModelCalls: number;
  p95ModelCalls: number;
  p50ToolCalls: number;
  p95ToolCalls: number;
  p50Tokens: number;
  p95Tokens: number;
  totalModelCalls: number;
  totalToolCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

const percentile = (values: readonly number[], ratio: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)]!;
};

export const summarizeAgentRuns = (runs: readonly AgentRunRecord[]): AgentRunObservability => {
  const totalRuns = runs.length;
  const rate = (count: number): number => (totalRuns === 0 ? 0 : count / totalRuns);
  const repaired = runs.filter((run) => run.repairAttempts > 0);
  const outcomeCounts = runs.reduce<Partial<Record<PageAgentOutcome, number>>>((counts, run) => {
    if (run.outcome) counts[run.outcome] = (counts[run.outcome] ?? 0) + 1;
    return counts;
  }, {});
  const durations = runs.flatMap((run) => (run.durationMs === undefined ? [] : [run.durationMs]));
  return {
    totalRuns,
    outcomeCounts,
    // A model call after the first is currently used only for terminal repair/retry.
    firstTerminalSuccessRate: rate(runs.filter((run) => run.modelCalls <= 1).length),
    repairRate: rate(repaired.length),
    repairSuccessRate:
      repaired.length === 0
        ? 1
        : repaired.filter((run) => run.status === 'completed').length / repaired.length,
    missingTerminalDecisionRate: rate(
      runs.filter((run) => run.errorCode === 'MISSING_TERMINAL_DECISION').length,
    ),
    workingConflictRate: rate(
      runs.filter((run) => run.errorCode === 'WORKING_VERSION_CONFLICT').length,
    ),
    recoveredCommitCount: runs.filter((run) => run.recoveredCommit).length,
    p50DurationMs: percentile(durations, 0.5),
    p95DurationMs: percentile(durations, 0.95),
    p50ModelCalls: percentile(
      runs.map((run) => run.modelCalls),
      0.5,
    ),
    p95ModelCalls: percentile(
      runs.map((run) => run.modelCalls),
      0.95,
    ),
    p50ToolCalls: percentile(
      runs.map((run) => run.toolCalls),
      0.5,
    ),
    p95ToolCalls: percentile(
      runs.map((run) => run.toolCalls),
      0.95,
    ),
    p50Tokens: percentile(
      runs.map((run) => run.inputTokens + run.outputTokens),
      0.5,
    ),
    p95Tokens: percentile(
      runs.map((run) => run.inputTokens + run.outputTokens),
      0.95,
    ),
    totalModelCalls: runs.reduce((sum, run) => sum + run.modelCalls, 0),
    totalToolCalls: runs.reduce((sum, run) => sum + run.toolCalls, 0),
    totalInputTokens: runs.reduce((sum, run) => sum + run.inputTokens, 0),
    totalOutputTokens: runs.reduce((sum, run) => sum + run.outputTokens, 0),
  };
};
