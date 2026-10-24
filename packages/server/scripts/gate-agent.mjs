import tooling from '../dist/tooling.cjs';

const report = await tooling.runAgentEvaluation(tooling.createRecordedEvaluationAdapter());
const gate = tooling.evaluateAgentReleaseGate(report, {
  activeRuns: 0,
  eventSubscribers: 0,
  openPreviewWrites: 0,
});
const result = {
  version: '1',
  kind: 'origamix-recorded-evaluation-check',
  evidence: {
    source: 'synthetic-fixtures',
    liveModelExecuted: false,
    runtimeSecurityAudited: false,
    resourceCountsMeasured: false,
    modelQualityAccepted: false,
  },
  passed: report.passed && gate.passed,
  evaluation: report,
  fixtureThresholdChecks: gate,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.passed) process.exitCode = 1;
