import { strictObject, AgentProtocolVersionSchema, IsoDateTimeSchema } from './agent-schema.ts';
import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';
import { PageAgentOutcomeSchema } from './agent-outcome.ts';
import { AgentRunStatusSchema } from './agent-run.ts';

export const AgentEvaluationCaseResultSchema = strictObject({
  caseId: Type.String({ pattern: '^eval_[a-z0-9_]+$' }),
  passed: Type.Boolean(),
  expectedOutcome: Type.Optional(PageAgentOutcomeSchema),
  actualOutcome: Type.Optional(PageAgentOutcomeSchema),
  status: AgentRunStatusSchema,
  firstEventMs: Type.Integer({ minimum: 0 }),
  durationMs: Type.Integer({ minimum: 0 }),
  inputTokens: Type.Integer({ minimum: 0 }),
  outputTokens: Type.Integer({ minimum: 0 }),
  modelCalls: Type.Integer({ minimum: 0 }),
  toolCalls: Type.Integer({ minimum: 0 }),
  schemaBytes: Type.Integer({ minimum: 0 }),
  repairAttempts: Type.Integer({ minimum: 0 }),
  terminalDecisionAttempts: Type.Integer({ minimum: 0 }),
  successfulWorkingCommits: Type.Integer({ minimum: 0 }),
  successResponsePublished: Type.Boolean(),
  errorStage: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })),
  toolTrace: Type.Array(Type.String({ minLength: 1, maxLength: 128 })),
  failures: Type.Array(Type.String({ minLength: 1, maxLength: 2_000 })),
});

export const AgentEvaluationReportSchema = strictObject({
  version: AgentProtocolVersionSchema,
  adapter: Type.Union([Type.Literal('fake'), Type.Literal('recorded'), Type.Literal('real')]),
  suiteVersion: Type.String({ minLength: 1, maxLength: 64 }),
  startedAt: IsoDateTimeSchema,
  finishedAt: IsoDateTimeSchema,
  passed: Type.Boolean(),
  summary: strictObject({
    total: Type.Integer({ minimum: 0 }),
    passed: Type.Integer({ minimum: 0 }),
    successRate: Type.Number({ minimum: 0, maximum: 1 }),
    firstTerminalSuccessRate: Type.Number({ minimum: 0, maximum: 1 }),
    repairRate: Type.Number({ minimum: 0, maximum: 1 }),
    repairSuccessRate: Type.Number({ minimum: 0, maximum: 1 }),
    missingTerminalDecisionRate: Type.Number({ minimum: 0, maximum: 1 }),
    workingConflictRate: Type.Number({ minimum: 0, maximum: 1 }),
    recoveredCommitCount: Type.Integer({ minimum: 0 }),
    outcomeCounts: Type.Record(Type.String(), Type.Integer({ minimum: 0 })),
    p50DurationMs: Type.Integer({ minimum: 0 }),
    p95FirstEventMs: Type.Integer({ minimum: 0 }),
    p95DurationMs: Type.Integer({ minimum: 0 }),
    p50ModelCalls: Type.Integer({ minimum: 0 }),
    p95ModelCalls: Type.Integer({ minimum: 0 }),
    p50ToolCalls: Type.Integer({ minimum: 0 }),
    p95ToolCalls: Type.Integer({ minimum: 0 }),
    p50Tokens: Type.Integer({ minimum: 0 }),
    p95Tokens: Type.Integer({ minimum: 0 }),
    totalInputTokens: Type.Integer({ minimum: 0 }),
    totalOutputTokens: Type.Integer({ minimum: 0 }),
    totalToolCalls: Type.Integer({ minimum: 0 }),
    peakSchemaBytes: Type.Integer({ minimum: 0 }),
  }),
  cases: Type.Array(AgentEvaluationCaseResultSchema),
});

export type AgentEvaluationCaseResult = Static<typeof AgentEvaluationCaseResultSchema>;

export type AgentEvaluationReport = Static<typeof AgentEvaluationReportSchema>;
