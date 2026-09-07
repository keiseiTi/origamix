import { describe, expect, it } from 'vitest';
import { runAgentEvaluation } from './evaluation-harness';
import { evaluateMvpGate } from './mvp-gate';

describe('MVP performance and release gate', () => {
  it('accepts bounded multi-page/continuous/cancel evidence after resources are released', async () => {
    const report = await runAgentEvaluation({
      kind: 'fake',
      run: async (testCase) => ({
        mode: testCase.expectedMode,
        status: testCase.expectedStatus,
        firstEventMs: 20,
        durationMs: testCase.id === 'eval_cancelled' ? 80 : 120,
        inputTokens: 0,
        outputTokens: 0,
        modelCalls: 0,
        toolCalls: testCase.expectedTool ? 1 : 0,
        schemaBytes: testCase.expectRevision ? 4_096 : 0,
        repairAttempts: testCase.expectRepair ? 1 : 0,
        toolTrace: testCase.expectedTool ? [testCase.expectedTool] : [],
        ...(testCase.expectRevision ? { resultRevisionId: `revision_${testCase.id}` } : {}),
        ...(testCase.expectedErrorCode ? { errorCode: testCase.expectedErrorCode } : {}),
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
        mode: testCase.expectedMode,
        status: testCase.expectedStatus,
        firstEventMs: 2_000,
        durationMs: 8_000,
        inputTokens: 1,
        outputTokens: 1,
        modelCalls: 7,
        toolCalls: 13,
        schemaBytes: 300_000,
        repairAttempts: testCase.expectRepair ? 1 : 0,
        toolTrace: testCase.expectedTool ? [testCase.expectedTool] : [],
        ...(testCase.expectRevision ? { resultRevisionId: `revision_${testCase.id}` } : {}),
        ...(testCase.expectedErrorCode ? { errorCode: testCase.expectedErrorCode } : {}),
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
