import type {
  AgentEvaluationCaseResult,
  AgentEvaluationReport,
  AgentRunStatus,
  PageAgentOutcome,
} from '@origamix/shared/protocol/agent';

export interface AgentEvaluationCase {
  id: `eval_${string}`;
  input: string;
  expectedStatus: AgentRunStatus;
  expectedOutcome?: PageAgentOutcome;
  expectWorkingUpdate: boolean;
  expectRepair?: boolean;
  expectedErrorCode?: string;
}

export interface AgentEvaluationObservation {
  status: AgentRunStatus;
  outcome?: PageAgentOutcome;
  firstEventMs: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  modelCalls: number;
  toolCalls: number;
  schemaBytes: number;
  repairAttempts: number;
  terminalDecisionAttempts: number;
  successfulWorkingCommits: number;
  successResponsePublished: boolean;
  toolTrace: string[];
  resultWorkingVersion?: number;
  errorCode?: string;
  errorStage?: string;
  recoveredCommit?: boolean;
}

export interface AgentEvaluationAdapter {
  readonly kind: AgentEvaluationReport['adapter'];
  run(testCase: AgentEvaluationCase): Promise<AgentEvaluationObservation>;
}

const observation = (
  status: AgentRunStatus,
  outcome: PageAgentOutcome | undefined,
  working = false,
  errorCode?: string,
  errorStage?: string,
): AgentEvaluationObservation => ({
  status,
  ...(outcome ? { outcome } : {}),
  firstEventMs: 20,
  durationMs: 120,
  inputTokens: 0,
  outputTokens: 0,
  modelCalls: 1,
  toolCalls: status === 'cancelled' ? 0 : 1,
  schemaBytes: working ? 4_096 : 0,
  repairAttempts: 0,
  terminalDecisionAttempts: status === 'cancelled' ? 0 : 1,
  successfulWorkingCommits: working ? 1 : 0,
  successResponsePublished: status === 'completed',
  toolTrace: status === 'cancelled' ? [] : ['complete_page_run'],
  ...(working ? { resultWorkingVersion: 2 } : {}),
  ...(errorCode ? { errorCode } : {}),
  ...(errorStage ? { errorStage } : {}),
});

const RECORDED_MVP_OBSERVATIONS: Readonly<Record<string, AgentEvaluationObservation>> = {
  eval_login_form: observation('completed', 'changed', true),
  eval_mixed_modify_question: observation('completed', 'changed_and_answered', true),
  eval_page_question: observation('completed', 'answered_only'),
  eval_no_change: observation('completed', 'no_change_needed'),
  eval_clarification: observation('completed', 'needs_clarification'),
  eval_refused: observation('completed', 'refused'),
  eval_partial_executable: observation('completed', 'changed', true),
  eval_unknown_material: observation('failed', undefined, false, 'TOOL_ERROR', 'validating'),
  eval_single_repair: {
    ...observation('completed', 'changed', true),
    repairAttempts: 1,
    terminalDecisionAttempts: 2,
  },
  eval_missing_terminal: observation(
    'failed',
    undefined,
    false,
    'MISSING_TERMINAL_DECISION',
    'reasoning',
  ),
  eval_working_conflict: observation(
    'failed',
    undefined,
    false,
    'WORKING_VERSION_CONFLICT',
    'validating',
  ),
  eval_cancelled: { ...observation('cancelled', undefined), durationMs: 80 },
};

export const createRecordedMvpAdapter = (): AgentEvaluationAdapter => ({
  kind: 'recorded',
  run: async (testCase) => {
    const recorded = RECORDED_MVP_OBSERVATIONS[testCase.id];
    if (!recorded) throw new Error(`缺少固定记录：${testCase.id}`);
    return { ...recorded, toolTrace: [...recorded.toolTrace] };
  },
});

export const FIXED_AGENT_EVALUATION_CASES: readonly AgentEvaluationCase[] = [
  {
    id: 'eval_login_form',
    input: '创建登录表单',
    expectedStatus: 'completed',
    expectedOutcome: 'changed',
    expectWorkingUpdate: true,
  },
  {
    id: 'eval_mixed_modify_question',
    input: '把按钮改成红色，并说明这个区域的用途',
    expectedStatus: 'completed',
    expectedOutcome: 'changed_and_answered',
    expectWorkingUpdate: true,
  },
  {
    id: 'eval_page_question',
    input: '说明当前表格有哪些列',
    expectedStatus: 'completed',
    expectedOutcome: 'answered_only',
    expectWorkingUpdate: false,
  },
  {
    id: 'eval_no_change',
    input: '清空已经为空的页面',
    expectedStatus: 'completed',
    expectedOutcome: 'no_change_needed',
    expectWorkingUpdate: false,
  },
  {
    id: 'eval_clarification',
    input: '修改两个同名按钮中的一个',
    expectedStatus: 'completed',
    expectedOutcome: 'needs_clarification',
    expectWorkingUpdate: false,
  },
  {
    id: 'eval_refused',
    input: '查询现实天气',
    expectedStatus: 'completed',
    expectedOutcome: 'refused',
    expectWorkingUpdate: false,
  },
  {
    id: 'eval_partial_executable',
    input: '把按钮改红，并连接不支持的 API',
    expectedStatus: 'completed',
    expectedOutcome: 'changed',
    expectWorkingUpdate: true,
  },
  {
    id: 'eval_unknown_material',
    input: '使用不存在的物料生成页面',
    expectedStatus: 'failed',
    expectWorkingUpdate: false,
    expectedErrorCode: 'TOOL_ERROR',
  },
  {
    id: 'eval_single_repair',
    input: '创建需要一次修复的表单',
    expectedStatus: 'completed',
    expectedOutcome: 'changed',
    expectWorkingUpdate: true,
    expectRepair: true,
  },
  {
    id: 'eval_missing_terminal',
    input: '模型未提交结构化终态',
    expectedStatus: 'failed',
    expectWorkingUpdate: false,
    expectedErrorCode: 'MISSING_TERMINAL_DECISION',
  },
  {
    id: 'eval_working_conflict',
    input: '在过期 Working 上修改表格',
    expectedStatus: 'failed',
    expectWorkingUpdate: false,
    expectedErrorCode: 'WORKING_VERSION_CONFLICT',
  },
  {
    id: 'eval_cancelled',
    input: '创建大型页面后取消',
    expectedStatus: 'cancelled',
    expectWorkingUpdate: false,
  },
];

const percentile = (values: readonly number[], ratio: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)]!;
};

const failuresFor = (
  testCase: AgentEvaluationCase,
  value: AgentEvaluationObservation,
): string[] => {
  const failures: string[] = [];
  if (value.status !== testCase.expectedStatus)
    failures.push(`状态应为 ${testCase.expectedStatus}`);
  if (value.outcome !== testCase.expectedOutcome)
    failures.push(`Outcome 应为 ${testCase.expectedOutcome ?? '空'}`);
  if (Boolean(value.resultWorkingVersion) !== testCase.expectWorkingUpdate)
    failures.push('Working 更新结果不符合预期');
  if (value.successfulWorkingCommits !== (testCase.expectWorkingUpdate ? 1 : 0))
    failures.push('成功 Working 提交次数必须符合预期且最多一次');
  if (testCase.expectRepair && value.repairAttempts !== 1) failures.push('应且只能修复一次');
  if (testCase.expectedErrorCode && value.errorCode !== testCase.expectedErrorCode)
    failures.push(`错误码应为 ${testCase.expectedErrorCode}`);
  if (value.status === 'failed' && !value.errorStage) failures.push('失败必须包含安全阶段分类');
  if (value.status !== 'completed' && value.successResponsePublished)
    failures.push('失败或取消后不得发布成功回复');
  if (value.resultWorkingVersion && value.status !== 'completed')
    failures.push('Working 已提交但 Run 未成功收敛');
  return failures;
};

export const runAgentEvaluation = async (
  adapter: AgentEvaluationAdapter,
  cases: readonly AgentEvaluationCase[] = FIXED_AGENT_EVALUATION_CASES,
  now: () => Date = () => new Date(),
): Promise<AgentEvaluationReport> => {
  const startedAt = now().toISOString();
  const results: AgentEvaluationCaseResult[] = [];
  const observations: AgentEvaluationObservation[] = [];
  for (const testCase of cases) {
    const value = await adapter.run(testCase);
    observations.push(value);
    const failures = failuresFor(testCase, value);
    results.push({
      caseId: testCase.id,
      passed: failures.length === 0,
      ...(testCase.expectedOutcome ? { expectedOutcome: testCase.expectedOutcome } : {}),
      ...(value.outcome ? { actualOutcome: value.outcome } : {}),
      status: value.status,
      firstEventMs: Math.max(0, Math.round(value.firstEventMs)),
      durationMs: Math.max(0, Math.round(value.durationMs)),
      inputTokens: Math.max(0, value.inputTokens),
      outputTokens: Math.max(0, value.outputTokens),
      modelCalls: Math.max(0, value.modelCalls),
      toolCalls: Math.max(0, value.toolCalls),
      schemaBytes: Math.max(0, value.schemaBytes),
      repairAttempts: Math.max(0, value.repairAttempts),
      terminalDecisionAttempts: Math.max(0, value.terminalDecisionAttempts),
      successfulWorkingCommits: Math.max(0, value.successfulWorkingCommits),
      successResponsePublished: value.successResponsePublished,
      ...(value.errorStage ? { errorStage: value.errorStage } : {}),
      toolTrace: [...value.toolTrace],
      failures,
    });
  }
  const passed = results.filter((item) => item.passed).length;
  const repairs = observations.filter((item) => item.repairAttempts > 0);
  const outcomeCounts = observations.reduce<Record<string, number>>((counts, item) => {
    if (item.outcome) counts[item.outcome] = (counts[item.outcome] ?? 0) + 1;
    return counts;
  }, {});
  const rate = (count: number): number =>
    observations.length === 0 ? 0 : count / observations.length;
  return {
    version: '1',
    adapter: adapter.kind,
    suiteVersion: 'unified-page-agent-1',
    startedAt,
    finishedAt: now().toISOString(),
    passed: passed === results.length,
    summary: {
      total: results.length,
      passed,
      successRate: results.length === 0 ? 1 : passed / results.length,
      firstTerminalSuccessRate:
        observations.length === 0
          ? 1
          : rate(observations.filter((item) => item.terminalDecisionAttempts <= 1).length),
      repairRate: rate(repairs.length),
      repairSuccessRate:
        repairs.length === 0
          ? 1
          : repairs.filter((item) => item.status === 'completed').length / repairs.length,
      missingTerminalDecisionRate: rate(
        observations.filter((item) => item.errorCode === 'MISSING_TERMINAL_DECISION').length,
      ),
      workingConflictRate: rate(
        observations.filter((item) => item.errorCode === 'WORKING_VERSION_CONFLICT').length,
      ),
      recoveredCommitCount: observations.filter((item) => item.recoveredCommit).length,
      outcomeCounts,
      p50DurationMs: percentile(
        results.map((item) => item.durationMs),
        0.5,
      ),
      p95FirstEventMs: percentile(
        results.map((item) => item.firstEventMs),
        0.95,
      ),
      p95DurationMs: percentile(
        results.map((item) => item.durationMs),
        0.95,
      ),
      p50ModelCalls: percentile(
        results.map((item) => item.modelCalls),
        0.5,
      ),
      p95ModelCalls: percentile(
        results.map((item) => item.modelCalls),
        0.95,
      ),
      p50ToolCalls: percentile(
        results.map((item) => item.toolCalls),
        0.5,
      ),
      p95ToolCalls: percentile(
        results.map((item) => item.toolCalls),
        0.95,
      ),
      p50Tokens: percentile(
        results.map((item) => item.inputTokens + item.outputTokens),
        0.5,
      ),
      p95Tokens: percentile(
        results.map((item) => item.inputTokens + item.outputTokens),
        0.95,
      ),
      totalInputTokens: results.reduce((sum, item) => sum + item.inputTokens, 0),
      totalOutputTokens: results.reduce((sum, item) => sum + item.outputTokens, 0),
      totalToolCalls: results.reduce((sum, item) => sum + item.toolCalls, 0),
      peakSchemaBytes: Math.max(0, ...results.map((item) => item.schemaBytes)),
    },
    cases: results,
  };
};
