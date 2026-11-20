import { Type, type Static } from '@sinclair/typebox';
import { strictObject } from './agent-schema.ts';

const id = Type.String({ minLength: 1, maxLength: 128 });
const sequence = Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER });

export const RuntimeRepairEvidenceSchema = strictObject({
  type: Type.Literal('runtime_repair'),
  snapshotId: Type.String({ pattern: '^[A-Za-z0-9_-]{1,128}$' }),
  runtimeSessionId: Type.String({ pattern: '^[A-Za-z0-9_-]{1,128}$' }),
  executionId: sequence,
  workingHash: Type.String({ pattern: '^[a-f0-9]{64}$' }),
  elementId: Type.String({ pattern: '^[A-Za-z][A-Za-z0-9_-]{0,127}$' }),
  flowId: id,
  nodeId: id,
  visited: Type.Array(id, { maxItems: 32 }),
  durationMs: Type.Number({ minimum: 0, maximum: 86400000 }),
  failure: Type.Union([
    strictObject({ code: Type.Literal('NODE_EXECUTION_ERROR') }),
    strictObject({
      code: Type.Literal('HTTP_ERROR'),
      status: Type.Integer({ minimum: 300, maximum: 599 }),
    }),
    strictObject({
      code: Type.Union([
        Type.Literal('TIMEOUT'),
        Type.Literal('NETWORK_ERROR'),
        Type.Literal('CONFIGURATION_ERROR'),
      ]),
    }),
  ]),
});

export type RuntimeRepairEvidence = Static<typeof RuntimeRepairEvidenceSchema>;
