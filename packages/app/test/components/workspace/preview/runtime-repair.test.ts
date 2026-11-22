import type { RuntimeObservation } from '@origamix/runtime';
import type { RuntimeRepairEvidence } from '@origamix/shared';
import { expect, it } from 'vitest';
import { findRepairReplay, readExecutionSteps } from '@/preview/runtime-repair';

it('requires a complete replay that reached the selected repair node', () => {
  const evidence: RuntimeRepairEvidence = {
    type: 'runtime_repair',
    snapshotId: 'preview_before',
    workingHash: 'a'.repeat(64),
    runtimeSessionId: 'before',
    executionId: 1,
    flowId: 'submit',
    elementId: 'button_submit',
    nodeId: 'check',
    visited: ['start'],
    durationMs: 12,
    failure: { code: 'NODE_EXECUTION_ERROR' },
  };
  const shared = { version: 1 as const, runtimeSessionId: 'after', executionId: 1, durationMs: 1 };
  const records: RuntimeObservation[] = [
    {
      ...shared,
      sequence: 1,
      kind: 'flow',
      flowId: 'submit',
      elementId: 'button_submit',
      status: 'started',
    },
    { ...shared, sequence: 2, kind: 'node', nodeId: 'start', status: 'completed' },
    { ...shared, sequence: 3, kind: 'node', nodeId: 'check', status: 'completed' },
    {
      ...shared,
      sequence: 4,
      kind: 'flow',
      flowId: 'submit',
      elementId: 'button_submit',
      status: 'completed',
    },
  ];
  const flow = records[3]!;
  if (flow.kind !== 'flow') throw new Error('Expected the fixture flow');
  expect(readExecutionSteps(records, flow, 3)?.map(({ nodeId }) => nodeId)).toEqual([
    'start',
    'check',
  ]);
  expect(readExecutionSteps([records[0]!, records[2]!, flow], flow, 3)).toBeUndefined();
  expect(findRepairReplay(evidence, records)).toBe(1);
  expect(findRepairReplay(evidence, records.slice(1))).toBeUndefined();
  expect(
    findRepairReplay(
      evidence,
      records.filter((entry) => entry.sequence !== 3),
    ),
  ).toBeUndefined();
  expect(
    findRepairReplay(evidence, [
      ...records.slice(0, 2),
      { ...shared, sequence: 3, kind: 'node', nodeId: 'different_branch', status: 'completed' },
      records[3]!,
    ]),
  ).toBeUndefined();
});
