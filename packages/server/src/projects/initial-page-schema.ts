import { SCHEMA_VERSION, type OrigamixPageSchema } from '@origamix/shared';

export const createInitialPageSchema = (): OrigamixPageSchema => ({
  elements: { element_root: { type: 'container', props: {} } },
  layout: { root: 'element_root', structure: { element_root: [] } },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: SCHEMA_VERSION } },
});
