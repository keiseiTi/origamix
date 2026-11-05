import type { LayoutOperation, ProjectLayoutDocument } from '@origamix/shared';
import { applySchemaOperationBatch } from '../schema/schema-operation-engine';

/** The existing editor protocol edits the project's sole layout schema. */
export const applyLayoutOperations = (
  document: ProjectLayoutDocument,
  operations: readonly LayoutOperation[],
): ProjectLayoutDocument => ({
  ...document,
  schema: applySchemaOperationBatch(document.schema, operations).schema,
});
