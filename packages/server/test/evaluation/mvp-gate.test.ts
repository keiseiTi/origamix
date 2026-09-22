import { describe, expect, it } from 'vitest';
import { runAgentEvaluation } from '../../evaluation/evaluation-harness';
import { evaluateMvpGate } from '../../evaluation/mvp-gate';

describe('MVP performance and release gate', () => {
  it('accepts bounded continuous/cancel evidence after resources are released', async () => {
    const report = await runAgentEvaluation({
      kind: 'fake',
      run: async (testCase) => ({
        status: testCase.expectedStatus,
        ...(testCase.expectedOutcome ? { outcome: testCase.expectedOutcome } : {}),
        firstEventMs: 20,
        durationMs: testCase.id === 'eval_cancelled' ? 80 : 120,
        inputTokens: 0,
        outputTokens: 0,
        modelCalls: 0,
        toolCalls: testCase.expectedStatus === 'cancelled' ? 0 : 1,
        schemaBytes: testCase.expectWorkingUpdate ? 4_096 : 0,
        repairAttempts: testCase.expectRepair ? 1 : 0,
        terminalDecisionAttempts: testCase.expectRepair ? 2 : 1,
        successfulWorkingCommits: testCase.expectWorkingUpdate ? 1 : 0,
        successResponsePublished: testCase.expectedStatus === 'completed',
        toolTrace: testCase.expectedStatus === 'cancelled' ? [] : ['complete_page_run'],
        ...(testCase.expectWorkingUpdate ? { resultWorkingVersion: 2 } : {}),
        ...(testCase.expectedErrorCode ? { errorCode: testCase.expectedErrorCode } : {}),
        ...(testCase.expectedStatus === 'failed' ? { errorStage: 'validating' } : {}),
      }),
    });
    expect(
      evaluateMvpGate(report, {
        activeRuns: 0,
        eventSubscribers: 0,
        openPreviewWrites: 0,
      }),
    ).toEqual({ passed: true, failures: [] });
  });

  it('fails on slow provider, oversized Schema, budget overrun or leaked resources', async () => {
    const report = await runAgentEvaluation({
      kind: 'recorded',
      run: async (testCase) => ({
        status: testCase.expectedStatus,
        ...(testCase.expectedOutcome ? { outcome: testCase.expectedOutcome } : {}),
        firstEventMs: 2_000,
        durationMs: 8_000,
        inputTokens: 1,
        outputTokens: 1,
        modelCalls: 7,
        toolCalls: 13,
        schemaBytes: 300_000,
        repairAttempts: testCase.expectRepair ? 1 : 0,
        terminalDecisionAttempts: testCase.expectRepair ? 2 : 1,
        successfulWorkingCommits: testCase.expectWorkingUpdate ? 1 : 0,
        successResponsePublished: testCase.expectedStatus === 'completed',
        toolTrace: testCase.expectedStatus === 'cancelled' ? [] : ['complete_page_run'],
        ...(testCase.expectWorkingUpdate ? { resultWorkingVersion: 2 } : {}),
        ...(testCase.expectedErrorCode ? { errorCode: testCase.expectedErrorCode } : {}),
        ...(testCase.expectedStatus === 'failed' ? { errorStage: 'validating' } : {}),
      }),
    });
    const result = evaluateMvpGate(report, {
      activeRuns: 1,
      eventSubscribers: 2,
      openPreviewWrites: 1,
    });
    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining('首事件 P95'),
        expect.stringContaining('完整运行 P95'),
        expect.stringContaining('Schema'),
        expect.stringContaining('活动 Run'),
        expect.stringContaining('SSE'),
        expect.stringContaining('Preview'),
      ]),
    );
  });
});
