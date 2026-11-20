import type { RuntimeObservation } from '@origamix/runtime';
import type { RuntimeRepairEvidence } from '@origamix/shared';

type Step = Extract<RuntimeObservation, { kind: 'node' | 'request' }>;

export const repairFailure = (step: Step): RuntimeRepairEvidence['failure'] | undefined => {
  if (step.kind === 'node') {
    if (step.status === 'failed') return { code: 'NODE_EXECUTION_ERROR' };
    return;
  }
  switch (step.status) {
    case 'http_error':
      return step.statusCode && step.statusCode >= 300
        ? { code: 'HTTP_ERROR', status: step.statusCode }
        : undefined;
    case 'timeout':
      return { code: 'TIMEOUT' };
    case 'network_error':
      return { code: 'NETWORK_ERROR' };
    case 'configuration_error':
      return { code: 'CONFIGURATION_ERROR' };
  }
};

export const findRepairReplay = (
  evidence: RuntimeRepairEvidence,
  records: RuntimeObservation[],
): number | undefined => {
  const executions = records.filter(
    (record) =>
      record.kind === 'flow' &&
      record.status === 'completed' &&
      record.runtimeSessionId !== evidence.runtimeSessionId &&
      record.elementId === evidence.elementId &&
      record.flowId === evidence.flowId,
  );
  for (const run of executions.reverse()) {
    if (run.kind !== 'flow') continue;
    const start = records.find(
      (record) =>
        record.kind === 'flow' &&
        record.status === 'started' &&
        record.executionId === run.executionId &&
        record.runtimeSessionId === run.runtimeSessionId,
    );
    if (!start || start.sequence >= run.sequence) continue;
    const interval = records.filter(
      (record) =>
        record.runtimeSessionId === run.runtimeSessionId &&
        record.sequence > start.sequence &&
        record.sequence < run.sequence,
    );
    if (interval.length !== run.sequence - start.sequence - 1) continue;
    const steps = interval.filter(
      (record): record is Step =>
        (record.kind === 'node' || record.kind === 'request') &&
        record.executionId === run.executionId &&
        record.runtimeSessionId === run.runtimeSessionId,
    );
    if (steps.some((step) => step.status !== 'completed')) continue;
    const nodes = steps.filter((step) => step.kind === 'node');
    if (!evidence.visited.every((id, index) => nodes[index]?.nodeId === id)) continue;
    const target = steps.some(
      (step) =>
        step.nodeId === evidence.nodeId &&
        step.status === 'completed' &&
        step.kind === (evidence.failure.code === 'NODE_EXECUTION_ERROR' ? 'node' : 'request'),
    );
    if (target) return run.executionId;
  }
};
