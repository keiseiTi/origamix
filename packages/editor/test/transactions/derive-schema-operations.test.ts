import { ORIGAMIX_VERSION } from '@origamix/shared';
import { describe, expect, it } from 'vitest';
import type { OrigamixPageSchema } from '@origamix/shared';
import { SchemaUtils } from '../../src/schema/schema-utils';
import { deriveSchemaOperations } from '../../src/transactions/derive-schema-operations';

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
  extensions: { origamix: { schemaVersion: ORIGAMIX_VERSION } },
});

describe('visual editor Operation Batch', () => {
  it('turns insertion and edits with removed props into Working operations', () => {
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
    after.elements.button_one!.props = {
      text: '提交',
      htmlType: 'submit',
      shape: 'round',
      alias: '主操作',
      layoutWidth: 'fill',
    };
    const edited = SchemaUtils.setElementProps(
      after,
      'button_one',
      { text: '保存' },
      {
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
          alias: { type: 'string' },
          layoutWidth: { type: 'string' },
        },
      },
    ).schema;
    expect(edited.elements.button_one!.props).toEqual({
      text: '保存',
      alias: '主操作',
      layoutWidth: 'fill',
    });
    expect(after.elements.button_one!.props.htmlType).toBe('submit');
    expect(edited.elements.text_one).toEqual(after.elements.text_one);
    expect(deriveSchemaOperations(after, edited)).toEqual([
      expect.objectContaining({
        operation: 'updateElementProps',
        elementId: 'button_one',
        set: { text: '保存' },
        unset: expect.arrayContaining(['htmlType', 'shape']),
      }),
    ]);
  });
});
