import { describe, expect, it } from 'vitest';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import {
  applySchemaOperationBatch,
  SchemaOperationError,
} from '../../schema/schema-operation-engine';

const createPage = (): OrigamixPageSchema => ({
  elements: {
    element_root: { type: 'container', props: { padding: 8 } },
    element_section: { type: 'container', props: {} },
    button_submit: { type: 'button', props: { children: '提交', loading: false } },
  },
  layout: {
    root: 'element_root',
    structure: {
      element_root: ['element_section'],
      element_section: ['button_submit'],
      button_submit: [],
    },
  },
  flows: { flow_submit: { startId: 'node_start', nodes: {} } },
  bindElements: [{ id: 'button_submit', event: 'onClick', flowId: 'flow_submit' }],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: '1.0' } },
});

describe('Schema Operation Engine', () => {
  it('applies an ordered element batch without mutating the source', () => {
    const source = createPage();
    const result = applySchemaOperationBatch(source, [
      {
        operation: 'addElement',
        elementId: 'text_help',
        element: { type: 'text', props: { children: '帮助信息' } },
        parentId: 'element_section',
        index: 0,
      },
      {
        operation: 'updateElementProps',
        elementId: 'button_submit',
        set: { children: '提交订单', type: 'primary' },
        unset: ['loading'],
      },
      {
        operation: 'moveElement',
        elementId: 'button_submit',
        parentId: 'element_root',
        index: 0,
      },
    ]);

    expect(result.schema.layout.structure.element_root).toEqual([
      'button_submit',
      'element_section',
    ]);
    expect(result.schema.layout.structure.element_section).toEqual(['text_help']);
    expect(result.schema.elements.button_submit.props).toEqual({
      children: '提交订单',
      type: 'primary',
    });
    expect(result.results.map(({ operation }) => operation)).toEqual([
      'addElement',
      'updateElementProps',
      'moveElement',
    ]);
    expect(source).toEqual(createPage());
  });

  it('requires explicit subtree deletion and cleans element bindings', () => {
    expect(() =>
      applySchemaOperationBatch(createPage(), [
        { operation: 'removeElement', elementId: 'element_section' },
      ]),
    ).toThrow('必须明确允许删除整个子树');

    const result = applySchemaOperationBatch(createPage(), [
      {
        operation: 'removeElement',
        elementId: 'element_section',
        removeDescendants: true,
      },
    ]);
    expect(result.schema.layout.structure.element_root).toEqual([]);
    expect(result.schema.elements.element_section).toBeUndefined();
    expect(result.schema.elements.button_submit).toBeUndefined();
    expect(result.schema.bindElements).toEqual([]);
  });

  it('fails atomically with the failing operation index', () => {
    const source = createPage();
    try {
      applySchemaOperationBatch(source, [
        {
          operation: 'addElement',
          elementId: 'text_temporary',
          element: { type: 'text', props: {} },
          parentId: 'element_root',
        },
        {
          operation: 'updateElementProps',
          elementId: 'element_missing',
          set: { children: '不会写入' },
        },
      ]);
      throw new Error('expected the operation batch to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaOperationError);
      expect(error).toMatchObject({ code: 'ELEMENT_NOT_FOUND', operationIndex: 1 });
    }
    expect(source).toEqual(createPage());
  });

  it('rejects disconnected and multi-parent subtrees', () => {
    expect(() =>
      applySchemaOperationBatch(createPage(), [
        {
          operation: 'insertSubtree',
          rootElementId: 'container_new',
          parentId: 'element_root',
          elements: {
            container_new: { type: 'container', props: {} },
            text_orphan: { type: 'text', props: {} },
          },
          structure: { container_new: [], text_orphan: [] },
        },
      ]),
    ).toThrow('必须且只能有一个父元素');

    expect(() =>
      applySchemaOperationBatch(createPage(), [
        {
          operation: 'insertSubtree',
          rootElementId: 'container_new',
          parentId: 'element_root',
          elements: {
            container_new: { type: 'container', props: {} },
            container_other: { type: 'container', props: {} },
            text_shared: { type: 'text', props: {} },
          },
          structure: {
            container_new: ['container_other', 'text_shared'],
            container_other: ['text_shared'],
            text_shared: [],
          },
        },
      ]),
    ).toThrow('必须且只能有一个父元素');
  });
});
