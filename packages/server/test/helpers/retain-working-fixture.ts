import type { OrigamixPageSchema } from '@origamix/shared';
import type { SchemaPageRef, WorkingDraftWriteOptions } from '../../src/schema/schema-contracts';
import {
  applyWorkingSchemaOperations,
  getWorkingSchemaState,
} from '../../src/schema/schema-service';

/** Retain a test fixture through the same operation pipeline as a visual editor. */
export const retainWorkingFixture = async (
  page: SchemaPageRef,
  { baseWorkingVersion, schema }: { baseWorkingVersion: number; schema: OrigamixPageSchema },
  options?: WorkingDraftWriteOptions,
) => {
  const current = (await getWorkingSchemaState(page)).schema;
  return applyWorkingSchemaOperations(
    page,
    {
      baseWorkingVersion,
      operations: [
        {
          operation: 'reconcileElementTree',
          layout: schema.layout,
          set: schema.elements,
          remove: Object.keys(current.elements).filter((id) => !Object.hasOwn(schema.elements, id)),
        },
        {
          operation: 'reconcileFlows',
          set: schema.flows,
          remove: Object.keys(current.flows).filter((id) => !Object.hasOwn(schema.flows, id)),
        },
        { operation: 'setElementBindings', bindings: schema.bindElements },
        { operation: 'updatePageContext', globalVariables: schema.context.globalVariables },
        { operation: 'setFlowGraph', graph: schema.extensions.flowGraph ?? null },
      ],
    },
    options,
  );
};
