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

  it('inserts a self-contained subtree whose later elements may reference earlier results', () => {
    const result = applySchemaOperationBatch(createPage(), [
      {
        operation: 'insertSubtree',
        rootElementId: 'form_profile',
        parentId: 'element_section',
        elements: {
          form_profile: { type: 'form', props: {} },
          input_name: { type: 'input', props: { placeholder: '姓名' } },
        },
        structure: { form_profile: ['input_name'], input_name: [] },
      },
      {
        operation: 'updateElementProps',
        elementId: 'input_name',
        set: { allowClear: true },
      },
    ]);

    expect(result.schema.layout.structure.element_section).toEqual([
      'button_submit',
      'form_profile',
    ]);
    expect(result.schema.layout.structure.form_profile).toEqual(['input_name']);
    expect(result.schema.elements.input_name.props.allowClear).toBe(true);
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

  it('manages flows, bindings and page context as domain operations', () => {
    const result = applySchemaOperationBatch(createPage(), [
      {
        operation: 'updateFlow',
        flowId: 'flow_submit',
        flow: { startId: 'node_updated', nodes: {} },
      },
      { operation: 'addFlow', flowId: 'flow_cancel', flow: { nodes: {} } },
      { operation: 'removeFlow', flowId: 'flow_submit' },
      {
        operation: 'setElementBindings',
        bindings: [{ id: 'button_submit', event: 'onClick', flowId: 'flow_cancel' }],
      },
      {
        operation: 'updatePageContext',
        globalVariables: [{ name: 'orderId', value: 'A-1' }],
      },
    ]);

    expect(result.schema.flows).toEqual({ flow_cancel: { nodes: {} } });
    expect(result.schema.bindElements).toEqual([
      { id: 'button_submit', event: 'onClick', flowId: 'flow_cancel' },
    ]);
    expect(result.schema.context.globalVariables).toEqual([{ name: 'orderId', value: 'A-1' }]);
  });

  it('rejects root removal, invalid moves and malformed operations', () => {
    expect(() =>
      applySchemaOperationBatch(createPage(), [
        { operation: 'removeElement', elementId: 'element_root', removeDescendants: true },
      ]),
    ).toThrow('不能删除页面根元素');
    expect(() =>
      applySchemaOperationBatch(createPage(), [
        {
          operation: 'moveElement',
          elementId: 'element_section',
          parentId: 'button_submit',
        },
      ]),
    ).toThrow('不能把元素移动到自身或其后代中');
    expect(() =>
      applySchemaOperationBatch(createPage(), [
        {
          operation: 'addElement',
          elementId: 'button_invalid',
          element: { type: 'button', props: {} },
          parentId: 'element_root',
          index: -1,
        },
      ]),
    ).toThrow('Schema Operation 格式无效');
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

  it('rejects a subtree with external layout references', () => {
    expect(() =>
      applySchemaOperationBatch(createPage(), [
        {
          operation: 'insertSubtree',
          rootElementId: 'container_new',
          parentId: 'element_root',
          elements: { container_new: { type: 'container', props: {} } },
          structure: { container_new: ['button_submit'] },
        },
      ]),
    ).toThrow('子树布局包含外部元素');
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
