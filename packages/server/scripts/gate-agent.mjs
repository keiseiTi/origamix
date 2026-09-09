import tooling from '../dist/tooling.cjs';

const report = await tooling.runAgentEvaluation(tooling.createRecordedMvpAdapter());
const security = tooling.auditAgentSecurity({
  logs: ['Authorization=[REDACTED]'],
  sqliteValues: ['credentialRef=desktop-safe-storage'],
  projectFiles: ['schemaVersion=1.0'],
  urls: ['http://127.0.0.1/api/v1/agent/runs/run_test/events'],
  sseFrames: ['event: run.completed'],
  clientState: ['connection=idle'],
  previewCapabilities: ['preview.readSnapshot'],
  deniedAttacks: [
    'prompt_injection', 'malicious_manifest', 'malicious_document', 'forged_page_id',
    'forged_run_id', 'forged_tool', 'cross_project_read', 'credential_request',
  ],
});
const gate = tooling.evaluateMvpGate(report, {
  activeRuns: 0,
  eventSubscribers: 0,
  openPreviewWrites: 0,
});
const result = {
  version: '1',
  kind: 'origamix-internal-gate',
  passed: report.passed && security.passed && gate.passed,
  evaluation: report,
  security,
  performance: gate,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.passed) process.exitCode = 1;
