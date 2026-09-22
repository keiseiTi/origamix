import { describe, expect, it } from 'vitest';
import { validateAgentEvaluationReport } from '@origamix/shared/protocol/agent-validation';
import {
  FIXED_AGENT_EVALUATION_CASES,
  runAgentEvaluation,
  type AgentEvaluationObservation,
} from '../../evaluation/evaluation-harness';

const recordedObservation = (
  testCase: (typeof FIXED_AGENT_EVALUATION_CASES)[number],
): AgentEvaluationObservation => {
  return {
    status: testCase.expectedStatus,
    ...(testCase.expectedOutcome ? { outcome: testCase.expectedOutcome } : {}),
    firstEventMs: 12,
    durationMs: 40,
    inputTokens: 20,
    outputTokens: 8,
    modelCalls: 1,
    toolCalls: testCase.expectedStatus === 'cancelled' ? 0 : 1,
    schemaBytes: testCase.expectWorkingUpdate ? 1_024 : 0,
    repairAttempts: testCase.expectRepair ? 1 : 0,
    terminalDecisionAttempts: testCase.expectRepair ? 2 : 1,
    successfulWorkingCommits: testCase.expectWorkingUpdate ? 1 : 0,
    successResponsePublished: testCase.expectedStatus === 'completed',
    toolTrace: testCase.expectedStatus === 'cancelled' ? [] : ['complete_page_run'],
    ...(testCase.expectWorkingUpdate ? { resultWorkingVersion: 2 } : {}),
    ...(testCase.expectedErrorCode ? { errorCode: testCase.expectedErrorCode } : {}),
    ...(testCase.expectedStatus === 'failed' ? { errorStage: 'validating' } : {}),
  };
};

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
        'eval_mixed_modify_question',
        'eval_page_question',
        'eval_no_change',
        'eval_clarification',
        'eval_refused',
        'eval_partial_executable',
        'eval_unknown_material',
        'eval_single_repair',
        'eval_missing_terminal',
        'eval_working_conflict',
        'eval_cancelled',
      ]),
    );
  });

  it('fails closed when outcome, Working and commit evidence disagree', async () => {
    const report = await runAgentEvaluation(
      {
        kind: 'fake',
        run: async () => ({
          ...recordedObservation(FIXED_AGENT_EVALUATION_CASES[0]!),
          outcome: 'answered_only',
          resultWorkingVersion: undefined,
          successfulWorkingCommits: 0,
          toolTrace: [],
        }),
      },
      [FIXED_AGENT_EVALUATION_CASES[0]!],
    );
    expect(report.passed).toBe(false);
    expect(report.cases[0]?.failures).toHaveLength(3);
  });
});
