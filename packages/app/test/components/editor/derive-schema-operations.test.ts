import { describe, expect, it } from 'vitest';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { deriveSchemaOperations } from '../../../src/components/editor/derive-schema-operations';

const schema = (): OrigamixPageSchema => ({
  elements: {
    element_root: { type: 'container', props: {} },
    text_one: { type: 'text', props: { content: 'before', color: 'red' } },
  },
  layout: {
    root: 'element_root',
    structure: { element_root: ['text_one'], text_one: [] },
  },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: '1.0' } },
});

describe('visual editor Operation Batch', () => {
  it('turns a newly inserted canvas element into a Working operation', () => {
    const before = schema();
    const after = structuredClone(before);
    after.elements.button_one = { type: 'button', props: { text: '提交' } };
    after.layout.structure.element_root = ['button_one', 'text_one'];
    after.layout.structure.button_one = [];

    expect(deriveSchemaOperations(before, after)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'addElement', elementId: 'button_one' }),
      ]),
    );
  });
});
