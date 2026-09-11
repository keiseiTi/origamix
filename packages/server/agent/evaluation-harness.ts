import type {
  AgentEvaluationCaseResult,
  AgentEvaluationReport,
  AgentRunStatus,
  RunMode,
} from '@origamix/shared/protocol/agent';

export interface AgentEvaluationCase {
  id: `eval_${string}`;
  input: string;
  expectedMode: RunMode;
  expectedStatus: AgentRunStatus;
  expectRevision: boolean;
  expectedTool?: string;
  expectRepair?: boolean;
  expectedErrorCode?: string;
}

export interface AgentEvaluationObservation {
  mode: RunMode;
  status: AgentRunStatus;
  firstEventMs: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  modelCalls: number;
  toolCalls: number;
  schemaBytes: number;
  repairAttempts: number;
  toolTrace: string[];
  resultRevisionId?: string;
  errorCode?: string;
}

export interface AgentEvaluationAdapter {
  readonly kind: AgentEvaluationReport['adapter'];
  run(testCase: AgentEvaluationCase): Promise<AgentEvaluationObservation>;
}

const observation = (
  mode: RunMode,
  status: AgentRunStatus,
  revision = false,
  toolTrace: string[] = [],
  errorCode?: string,
): AgentEvaluationObservation => {
  return {
    mode,
    status,
    firstEventMs: 20,
    durationMs: 120,
    inputTokens: 0,
    outputTokens: 0,
    modelCalls: 0,
    toolCalls: toolTrace.length,
    schemaBytes: revision ? 4_096 : 0,
    repairAttempts: 0,
    toolTrace,
    ...(revision ? { resultRevisionId: `revision_recorded_${mode}` } : {}),
    ...(errorCode ? { errorCode } : {}),
  };
};

const RECORDED_MVP_OBSERVATIONS: Readonly<Record<string, AgentEvaluationObservation>> = {
  eval_login_form: observation('page_modify', 'completed', true, ['replace_page_schema']),
  eval_customer_form_table: observation('page_modify', 'completed', true, ['replace_page_schema']),
  eval_add_table_column: observation('page_modify', 'completed', true, ['replace_page_schema']),
  eval_modify_button: observation('page_modify', 'completed', true, ['replace_page_schema']),
  eval_page_question: observation('page_question', 'completed'),
  eval_weather_rejected: observation('out_of_scope', 'completed'),
  eval_weather_page: observation('page_modify', 'completed', true, ['replace_page_schema']),
  eval_ambiguous: observation('clarification_required', 'completed'),
  eval_unknown_material: observation('page_modify', 'failed', false, [], 'TOOL_ERROR'),
  eval_single_repair: {
    ...observation('page_modify', 'completed', true, ['replace_page_schema']),
    repairAttempts: 1,
  },
  eval_revision_conflict: observation('page_modify', 'failed', false, [], 'REVISION_CONFLICT'),
  eval_cancelled: { ...observation('page_modify', 'cancelled'), durationMs: 80 },
};

/** Recorded CI adapter. It contains no provider credentials or captured user content. */
export const createRecordedMvpAdapter = (): AgentEvaluationAdapter => {
  return {
    kind: 'recorded',
    run: async (testCase) => {
      const recorded = RECORDED_MVP_OBSERVATIONS[testCase.id];
      if (!recorded) throw new Error(`缺少固定记录：${testCase.id}`);
      return { ...recorded, toolTrace: [...recorded.toolTrace] };
    },
  };
};

export const FIXED_AGENT_EVALUATION_CASES: readonly AgentEvaluationCase[] = [
  {
    id: 'eval_login_form',
    input: '创建登录表单',
    expectedMode: 'page_modify',
    expectedStatus: 'completed',
    expectRevision: true,
    expectedTool: 'replace_page_schema',
  },
  {
    id: 'eval_customer_form_table',
    input: '创建客户表单和表格',
    expectedMode: 'page_modify',
    expectedStatus: 'completed',
    expectRevision: true,
    expectedTool: 'replace_page_schema',
  },
  {
    id: 'eval_add_table_column',
    input: '给已有表格增加状态列',
    expectedMode: 'page_modify',
    expectedStatus: 'completed',
    expectRevision: true,
    expectedTool: 'replace_page_schema',
  },
  {
    id: 'eval_modify_button',
    input: '把提交按钮改成主要按钮',
    expectedMode: 'page_modify',
    expectedStatus: 'completed',
    expectRevision: true,
    expectedTool: 'replace_page_schema',
  },
  {
    id: 'eval_page_question',
    input: '表格在搭建器里如何配置',
    expectedMode: 'page_question',
    expectedStatus: 'completed',
    expectRevision: false,
  },
  {
    id: 'eval_weather_rejected',
    input: '今天天气怎么样',
    expectedMode: 'out_of_scope',
    expectedStatus: 'completed',
    expectRevision: false,
  },
  {
    id: 'eval_weather_page',
    input: '创建一个天气展示页面',
    expectedMode: 'page_modify',
    expectedStatus: 'completed',
    expectRevision: true,
    expectedTool: 'replace_page_schema',
  },
  {
    id: 'eval_ambiguous',
    input: '加一个天气',
    expectedMode: 'clarification_required',
    expectedStatus: 'completed',
    expectRevision: false,
  },
  {
    id: 'eval_unknown_material',
    input: '使用不存在的物料生成页面',
    expectedMode: 'page_modify',
    expectedStatus: 'failed',
    expectRevision: false,
    expectedErrorCode: 'TOOL_ERROR',
  },
  {
    id: 'eval_single_repair',
    input: '创建需要一次修复的表单',
    expectedMode: 'page_modify',
    expectedStatus: 'completed',
    expectRevision: true,
    expectedTool: 'replace_page_schema',
    expectRepair: true,
  },
  {
    id: 'eval_revision_conflict',
    input: '在过期版本上修改表格',
    expectedMode: 'page_modify',
    expectedStatus: 'failed',
    expectRevision: false,
    expectedErrorCode: 'REVISION_CONFLICT',
  },
  {
    id: 'eval_cancelled',
    input: '创建一个大型客户页面后取消',
    expectedMode: 'page_modify',
    expectedStatus: 'cancelled',
    expectRevision: false,
  },
] as const;

const percentile95 = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)]!;
};

const failuresFor = (
  testCase: AgentEvaluationCase,
  observation: AgentEvaluationObservation,
): string[] => {
  const failures: string[] = [];
  if (observation.mode !== testCase.expectedMode)
    failures.push(`意图应为 ${testCase.expectedMode}`);
  if (observation.status !== testCase.expectedStatus)
    failures.push(`状态应为 ${testCase.expectedStatus}`);
  if (Boolean(observation.resultRevisionId) !== testCase.expectRevision)
    failures.push('Revision 结果不符合预期');
  if (testCase.expectedTool && !observation.toolTrace.includes(testCase.expectedTool))
    failures.push(`缺少工具轨迹 ${testCase.expectedTool}`);
  if (testCase.expectRepair && observation.repairAttempts !== 1) failures.push('应且只能修复一次');
  if (testCase.expectedErrorCode && observation.errorCode !== testCase.expectedErrorCode)
    failures.push(`错误码应为 ${testCase.expectedErrorCode}`);
  return failures;
};

export const runAgentEvaluation = async (
  adapter: AgentEvaluationAdapter,
  cases: readonly AgentEvaluationCase[] = FIXED_AGENT_EVALUATION_CASES,
  now: () => Date = () => new Date(),
): Promise<AgentEvaluationReport> => {
  const startedAt = now().toISOString();
  const results: AgentEvaluationCaseResult[] = [];
  for (const testCase of cases) {
    const observation = await adapter.run(testCase);
    const failures = failuresFor(testCase, observation);
    results.push({
      caseId: testCase.id,
      passed: failures.length === 0,
      expectedMode: testCase.expectedMode,
      actualMode: observation.mode,
      status: observation.status,
      firstEventMs: Math.max(0, Math.round(observation.firstEventMs)),
      durationMs: Math.max(0, Math.round(observation.durationMs)),
      inputTokens: Math.max(0, observation.inputTokens),
      outputTokens: Math.max(0, observation.outputTokens),
      modelCalls: Math.max(0, observation.modelCalls),
      toolCalls: Math.max(0, observation.toolCalls),
      schemaBytes: Math.max(0, observation.schemaBytes),
      repairAttempts: Math.max(0, observation.repairAttempts),
      toolTrace: [...observation.toolTrace],
      failures,
    });
  }
  const passed = results.filter((item) => item.passed).length;
  return {
    version: '1',
    adapter: adapter.kind,
    suiteVersion: 'mvp-1',
    startedAt,
    finishedAt: now().toISOString(),
    passed: passed === results.length,
    summary: {
      total: results.length,
      passed,
      successRate: results.length === 0 ? 1 : passed / results.length,
      p95FirstEventMs: percentile95(results.map((item) => item.firstEventMs)),
      p95DurationMs: percentile95(results.map((item) => item.durationMs)),
      totalInputTokens: results.reduce((sum, item) => sum + item.inputTokens, 0),
      totalOutputTokens: results.reduce((sum, item) => sum + item.outputTokens, 0),
      totalToolCalls: results.reduce((sum, item) => sum + item.toolCalls, 0),
      peakSchemaBytes: Math.max(0, ...results.map((item) => item.schemaBytes)),
    },
    cases: results,
  };
};
