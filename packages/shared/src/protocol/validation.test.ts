import { describe, expect, it } from 'vitest';
import { validateChangeSet, validatePage } from './validation';

const emptyPage = {
  elements: { element_root: { type: 'container', props: {} } },
  layout: { root: 'element_root', structure: { element_root: [] } },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: '1.0' } },
};

describe('page protocol validation', () => {
  it('accepts the canonical empty page', () => {
    expect(validatePage(emptyPage)).toEqual({ valid: true, errors: [], semanticErrors: [] });
  });

  it('rejects a missing root element', () => {
    const result = validatePage({
      ...emptyPage,
      layout: { ...emptyPage.layout, root: 'element_missing' },
    });
    expect(result.valid).toBe(false);
    expect(result.semanticErrors[0]?.code).toBe('ROOT_NOT_FOUND');
  });

  it('rejects dangling layout references', () => {
    const result = validatePage({
      ...emptyPage,
      layout: { ...emptyPage.layout, structure: { element_root: ['element_missing'] } },
    });
    expect(result.semanticErrors[0]?.code).toBe('LAYOUT_ELEMENT_NOT_FOUND');
  });

  it('rejects layout cycles', () => {
    const result = validatePage({
      ...emptyPage,
      elements: {
        ...emptyPage.elements,
        element_child: { type: 'container', props: {} },
      },
      layout: {
        ...emptyPage.layout,
        structure: { element_root: ['element_child'], element_child: ['element_root'] },
      },
    });
    expect(result.semanticErrors[0]?.code).toBe('LAYOUT_CYCLE');
  });

  it('accepts a replaceSchema change set', () => {
    expect(
      validateChangeSet({
        changeSetId: 'change_1',
        pageId: 'page_1',
        baseRevisionId: 'revision_1',
        source: { kind: 'user' },
        createdAt: '2026-08-27T00:00:00.000Z',
        operation: 'replaceSchema',
        schema: emptyPage,
      }).valid,
    ).toBe(true);
  });
});
