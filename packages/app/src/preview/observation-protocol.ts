import type { RuntimeObservation } from '@origamix/runtime';

const statuses = {
  render: ['ready', 'degraded', 'failed'],
  flow: ['started', 'completed', 'failed', 'cancelled'],
  node: ['completed', 'failed'],
  request: [
    'completed',
    'http_error',
    'timeout',
    'network_error',
    'configuration_error',
    'cancelled',
  ],
};

const fields = {
  render: [],
  flow: ['executionId', 'flowId', 'elementId'],
  node: ['executionId', 'nodeId', 'code'],
  request: ['executionId', 'nodeId', 'method', 'statusCode'],
};

const isId = (value: unknown): boolean =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const isSchemaId = (value: unknown): boolean =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 128 &&
  !['__proto__', 'prototype', 'constructor'].includes(value);
const isSequence = (value: unknown): boolean =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export const parsePreviewObservation = (
  data: unknown,
  snapshotId: string,
): RuntimeObservation | undefined => {
  if (!data || typeof data !== 'object') return;
  const message = data as Record<string, unknown>;
  if (
    message.type !== 'origamix.preview.observation' ||
    message.snapshotId !== snapshotId ||
    !message.record ||
    typeof message.record !== 'object'
  )
    return;
  const record = message.record as Record<string, unknown>;
  const kind = record.kind as keyof typeof statuses;
  if (
    typeof kind !== 'string' ||
    !Object.hasOwn(statuses, kind) ||
    !statuses[kind].includes(record.status as string) ||
    record.version !== 1 ||
    !isId(record.runtimeSessionId) ||
    !isSequence(record.sequence) ||
    typeof record.durationMs !== 'number' ||
    !Number.isFinite(record.durationMs) ||
    record.durationMs < 0
  )
    return;
  const allowed = [
    'kind',
    'status',
    'version',
    'runtimeSessionId',
    'sequence',
    'durationMs',
    ...fields[kind],
  ];
  if (Object.keys(record).some((key) => !allowed.includes(key))) return;
  if (kind !== 'render' && !isSequence(record.executionId)) return;
  if (kind === 'flow' && (!isSchemaId(record.flowId) || !isId(record.elementId))) return;
  if ((kind === 'node' || kind === 'request') && !isSchemaId(record.nodeId)) return;
  if (record.code !== undefined && record.code !== 'NODE_EXECUTION_ERROR') return;
  if (
    record.method !== undefined &&
    !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(record.method as string)
  )
    return;
  if (
    record.statusCode !== undefined &&
    (typeof record.statusCode !== 'number' ||
      !Number.isInteger(record.statusCode) ||
      record.statusCode < 100 ||
      record.statusCode > 599)
  )
    return;
  return record as RuntimeObservation;
};
