import type { OrigamixPageSchema } from '@origamix/shared';
import type { RevisionCommitOptions } from './revision-commit';
import type { WorkingSchemaPageRef } from './working-schema-store';

export interface SchemaWriteOptions extends RevisionCommitOptions {
  /** Re-check cancellation or authority after queueing, before the first durable write. */
  beforeWrite?: () => void | Promise<void>;
}
export type WorkingDraftWriteStage = 'receipt_prepared' | 'working' | 'receipt_committed';
export interface AgentWorkingCommitInput {
  runId: string;
  projectId: string;
  operationDigest: string;
}
export interface WorkingDraftWriteOptions extends Pick<SchemaWriteOptions, 'beforeWrite'> {
  migration?: { from: string; to: string };
  agentCommit?: AgentWorkingCommitInput;
  /** Test hook for deterministic interruption at a durable Agent write boundary. */
  afterWorkingStage?: (stage: WorkingDraftWriteStage) => void | Promise<void>;
}
export type SchemaPageRef = WorkingSchemaPageRef;
export interface SchemaReadResult {
  schema: OrigamixPageSchema;
  revisionId: string;
}
export interface WorkingSchemaReadResult extends SchemaReadResult {
  migration?: { from: string; to: string };
  workingVersion: number;
  workingHash: string;
  savedSchemaHash: string;
  baselineHash: string;
}
