import type { OrigamixPageSchema, ProjectManifest } from '@origamix/shared';
import type { RevisionCommitOptions } from './revision-commit';
import type { WorkingSchemaPageRef, SchemaStorage } from './schema-storage';

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
  validateCandidate?: (schema: OrigamixPageSchema) => void | Promise<void>;
  agentCommit?: AgentWorkingCommitInput;
  /** Test hook for deterministic interruption at a durable Agent write boundary. */
  afterWorkingStage?: (stage: WorkingDraftWriteStage) => void | Promise<void>;
}
export interface SchemaPersistence {
  store: SchemaStorage;
  manifest: ProjectManifest;
}

export interface SchemaPageRef extends WorkingSchemaPageRef {
  persistence?: SchemaPersistence;
  withPersistence?<T>(action: (persistence: SchemaPersistence) => Promise<T>): Promise<T>;
}
export interface SchemaReadResult {
  schema: OrigamixPageSchema;
  revisionId: string;
}
export interface WorkingSchemaReadResult extends SchemaReadResult {
  workingVersion: number;
  workingHash: string;
  savedSchemaHash: string;
  baselineHash: string;
}
