import { createElementId, SCHEMA_VERSION, type OrigamixPageSchema } from '@origamix/shared';
import { nanoid } from 'nanoid';

export const createInitialPageSchema = (): OrigamixPageSchema => {
  const root = createElementId('container', nanoid);
  return {
    elements: { [root]: { type: 'container', props: {} } },
    layout: { root, structure: { [root]: [] } },
    flows: {},
    bindElements: [],
    context: { globalVariables: [] },
    extensions: { origamix: { schemaVersion: SCHEMA_VERSION } },
  };
};
