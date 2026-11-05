import { expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../../src/version.ts';
import { createEmptyLayoutDocument, PAGE_OUTLET_TYPE } from '../../src/layout/layout-schema.ts';
import { validateLayoutDocument } from '../../src/layout/layout-validation.ts';

it('validates the independent layout contract and its unique, reachable, leaf outlet', () => {
  const document = createEmptyLayoutDocument('project_test');
  document.schema = {
    elements: {
      root: { type: 'container', props: {} },
      outlet: { type: PAGE_OUTLET_TYPE, props: { layoutGrow: 1 } },
    },
    layout: { root: 'root', structure: { root: ['outlet'] } },
    flows: {},
    bindElements: [],
    context: { globalVariables: [] },
    extensions: { origamix: { schemaVersion: SCHEMA_VERSION } },
  };
  expect(validateLayoutDocument(document)).toEqual([]);
  expect(
    validateLayoutDocument({ ...document, pageBindings: { page_test: { mode: 'none' } } })[0]?.code,
  ).toBe('INVALID_LAYOUT_DOCUMENT');
  document.schema.layout.structure.root = [];
  expect(
    validateLayoutDocument(document).some((issue) => issue.code === 'INVALID_PAGE_OUTLET'),
  ).toBe(true);
  expect(validateLayoutDocument({ ...document, schemaVersion: '2.0.0' })[0]?.code).toBe(
    'INVALID_LAYOUT_DOCUMENT',
  );
});
