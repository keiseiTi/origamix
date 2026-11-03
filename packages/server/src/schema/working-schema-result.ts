import type { WorkingSchemaFile } from './working-schema-store';
import type { WorkingSchemaReadResult } from './schema-contracts';

export const workingResult = (working: WorkingSchemaFile): WorkingSchemaReadResult => ({
  schema: working.schema,
  revisionId: working.lastSavedRevisionId,
  workingVersion: working.workingVersion,
  workingHash: working.workingHash,
  savedSchemaHash: working.savedSchemaHash,
  baselineHash: working.baselineHash,
});
