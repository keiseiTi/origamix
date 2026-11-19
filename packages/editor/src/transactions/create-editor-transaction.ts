import type { OrigamixPageSchema } from '@origamix/shared';
import type { EditorTransaction, EditorWorkingState } from '../interfaces/editor';
import { deriveSchemaOperations } from './derive-schema-operations';

/** The host decides when to flush; this function only translates a draft. */
export const createEditorTransaction = (
  working: EditorWorkingState,
  candidate: OrigamixPageSchema,
): EditorTransaction => {
  const operations = deriveSchemaOperations(working.schema, candidate);
  const [first, ...rest] = operations;
  if (!first) throw new Error('没有可提交的页面修改');
  return {
    scope: working.scope,
    baseWorkingVersion: working.workingVersion,
    operations: [first, ...rest],
  };
};
