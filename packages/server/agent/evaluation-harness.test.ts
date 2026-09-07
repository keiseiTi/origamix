import { describe, expect, it } from 'vitest';
import { validateAgentEvaluationReport } from '@origamix/shared/protocol/agent-validation';
import {
  FIXED_AGENT_EVALUATION_CASES,
  runAgentEvaluation,
  type AgentEvaluationObservation,
} from './evaluation-harness';

function recordedObservation(
  testCase: (typeof FIXED_AGENT_EVALUATION_CASES)[number],
): AgentEvaluationObservation {
  return {
    mode: testCase.expectedMode,
    status: testCase.expectedStatus,
    firstEventMs: 12,
    durationMs: 40,
    inputTokens: testCase.expectedMode === 'page_modify' ? 20 : 0,
    outputTokens: 8,
    modelCalls: testCase.expectedMode === 'page_modify' ? 1 : 0,
    toolCalls: testCase.expectedTool ? 1 : 0,
    schemaBytes: testCase.expectRevision ? 1_024 : 0,
    repairAttempts: testCase.expectRepair ? 1 : 0,
    toolTrace: testCase.expectedTool ? [testCase.expectedTool] : [],
    ...(testCase.expectRevision ? { resultRevisionId: `revision_${testCase.id}` } : {}),
    ...(testCase.expectedErrorCode ? { errorCode: testCase.expectedErrorCode } : {}),
  };
}

describe('fixed Agent evaluation harness', () => {
  it('covers every MVP behavior with a versioned, aggregate report', async () => {
    const report = await runAgentEvaluation({
      kind: 'recorded',
      run: async (testCase) => recordedObservation(testCase),
    });
    expect(report.passed).toBe(true);
    expect(report.summary).toMatchObject({ total: 12, passed: 12, successRate: 1 });
    expect(validateAgentEvaluationReport(report).valid).toBe(true);
    expect(report.cases.map((item) => item.caseId)).toEqual(
      expect.arrayContaining([
        'eval_login_form',
        'eval_customer_form_table',
        'eval_add_table_column',
        'eval_modify_button',
        'eval_page_question',
        'eval_weather_rejected',
        'eval_weather_page',
        'eval_ambiguous',
        'eval_unknown_material',
        'eval_single_repair',
        'eval_revision_conflict',
        'eval_cancelled',
      ]),
    );
  });

  it('fails closed and names mismatched intent, revision and tool evidence', async () => {
    const report = await runAgentEvaluation(
      {
        kind: 'fake',
        run: async () => ({
          ...recordedObservation(FIXED_AGENT_EVALUATION_CASES[0]!),
          mode: 'page_question',
          resultRevisionId: undefined,
          toolTrace: [],
        }),
      },
      [FIXED_AGENT_EVALUATION_CASES[0]!],
    );
    expect(report.passed).toBe(false);
    expect(report.cases[0]?.failures).toHaveLength(3);
  });
});
