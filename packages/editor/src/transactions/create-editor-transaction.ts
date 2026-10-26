import type { OrigamixPageSchema } from '@origamix/shared';
import type { EditorTransaction, EditorWorkingState } from '../contracts/editor-contracts';
import { deriveSchemaOperations } from './derive-schema-operations';

/** The host decides when to flush; this function only translates a draft. */
export const createEditorTransaction = (
  working: EditorWorkingState,
  candidate: OrigamixPageSchema,
): EditorTransaction => {
  const operations = deriveSchemaOperations(working.schema, candidate);
  const first = operations?.[0];
  return first && operations
    ? {
        scope: working.scope,
        baseWorkingVersion: working.workingVersion,
        kind: 'operations',
        operations: [first, ...operations.slice(1)],
      }
    : {
        scope: working.scope,
        baseWorkingVersion: working.workingVersion,
        kind: 'candidate',
        reason: 'operation-protocol-gap',
        schema: candidate,
      };
};
