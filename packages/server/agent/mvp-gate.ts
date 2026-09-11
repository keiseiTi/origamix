import type { AgentEvaluationReport } from '@origamix/shared/protocol/agent';

export interface MvpGateThresholds {
  minimumSuccessRate: number;
  maximumP95FirstEventMs: number;
  maximumP95DurationMs: number;
  maximumSchemaBytes: number;
  maximumModelCallsPerCase: number;
  maximumToolCallsPerCase: number;
}

export const DEFAULT_FAKE_MVP_THRESHOLDS: MvpGateThresholds = {
  minimumSuccessRate: 1,
  maximumP95FirstEventMs: 1_000,
  maximumP95DurationMs: 5_000,
  maximumSchemaBytes: 256 * 1_024,
  maximumModelCallsPerCase: 6,
  maximumToolCallsPerCase: 12,
};

export interface AgentResourceSnapshot {
  activeRuns: number;
  eventSubscribers: number;
  openPreviewWrites: number;
}

export interface MvpGateResult {
  passed: boolean;
  failures: string[];
}

export const evaluateMvpGate = (
  report: AgentEvaluationReport,
  resources: AgentResourceSnapshot,
  thresholds: MvpGateThresholds = DEFAULT_FAKE_MVP_THRESHOLDS,
): MvpGateResult => {
  const failures: string[] = [];
  if (!report.passed || report.summary.successRate < thresholds.minimumSuccessRate) {
    failures.push(`成功率 ${report.summary.successRate} 未达到 ${thresholds.minimumSuccessRate}`);
  }
  if (report.summary.p95FirstEventMs > thresholds.maximumP95FirstEventMs) {
    failures.push(`首事件 P95 ${report.summary.p95FirstEventMs}ms 超过门槛`);
  }
  if (report.summary.p95DurationMs > thresholds.maximumP95DurationMs) {
    failures.push(`完整运行 P95 ${report.summary.p95DurationMs}ms 超过门槛`);
  }
  if (report.summary.peakSchemaBytes > thresholds.maximumSchemaBytes) {
    failures.push(`Schema ${report.summary.peakSchemaBytes} bytes 超过门槛`);
  }
  for (const item of report.cases) {
    if (item.modelCalls > thresholds.maximumModelCallsPerCase)
      failures.push(`${item.caseId} 模型调用超额`);
    if (item.toolCalls > thresholds.maximumToolCallsPerCase)
      failures.push(`${item.caseId} 工具调用超额`);
  }
  if (resources.activeRuns !== 0) failures.push(`仍有 ${resources.activeRuns} 个活动 Run`);
  if (resources.eventSubscribers !== 0)
    failures.push(`仍有 ${resources.eventSubscribers} 个 SSE 订阅`);
  if (resources.openPreviewWrites !== 0) failures.push('Preview 出现写入能力');
  return { passed: failures.length === 0, failures };
};
