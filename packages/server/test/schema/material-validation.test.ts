import { ORIGAMIX_VERSION } from '@origamix/shared';
import { describe, expect, it } from 'vitest';
import type { OrigamixPageSchema } from '@origamix/shared';
import {
  defaultMaterialValidationRuntime,
  validatePageAgainstMaterials,
} from '../../src/schema/validation/material-validation';
import { type MaterialValidationRuntime } from '../../src/schema/validation/validation-contracts';

const supportedSet = [{ id: 'official-antd', version: '1.0.0' }] as const;

const page = (): OrigamixPageSchema => {
  return {
    elements: {
      element_root: { type: 'basicPage', props: {} },
      form_main: { type: 'form', props: { layout: 'vertical' } },
      input_name: { type: 'input', props: { placeholder: '姓名' } },
      button_save: { type: 'button', props: { text: '保存', href: '/saved' } },
    },
    layout: {
      root: 'element_root',
      structure: {
        element_root: ['form_main', 'button_save'],
        form_main: ['input_name'],
        input_name: [],
        button_save: [],
      },
    },
    flows: {
      flow_save: {
        startId: 'node_start',
        nodes: { node_start: { id: 'node_start', type: 'start', props: {}, prev: [], next: [] } },
      },
    },
    bindElements: [{ id: 'button_save', event: 'onClick', flowId: 'flow_save' }],
    context: { globalVariables: [] },
    extensions: { origamix: { schemaVersion: ORIGAMIX_VERSION } },
  };
};

const codes = (
  schema: OrigamixPageSchema,
  sets: readonly { id: string; version: string }[] = supportedSet,
): string[] => {
  return validatePageAgainstMaterials(schema, sets).errors.map((item) => item.code);
};

describe('Manifest-driven Schema validation', () => {
  it('accepts declared props, hierarchy, event, binding and safe URL', () => {
    const schema = page();
    schema.flows!.flow_save = {
      startId: 'node_start',
      nodes: {
        node_start: { id: 'node_start', type: 'start', props: {}, prev: [], next: ['script'] },
        script: {
          id: 'script',
          type: 'customJS',
          prev: ['node_start'],
          next: [],
          props: {
            value: {
              type: 'function',
              value: { params: [], body: 'throw new Error("must not run on Server");' },
            },
          },
        },
      },
    };
    schema.elements.button_save!.props = {
      text: '保存',
      href: '/saved',
      size: 'small',
      danger: true,
      block: true,
      htmlType: 'button',
      layoutWidth: 'fixed',
      layoutFixedWidth: 240,
      layoutGrow: 1,
    };
    schema.elements.input_name!.props = { defaultValue: '姓名', readOnly: true, variant: 'filled' };
    const inputs = {
      textarea: { autoSize: { minRows: 2, maxRows: 5 }, readOnly: true },
      select: { options: [{ label: '数字选项', value: 1 }], status: 'warning', virtual: false },
      checkbox: { options: [{ label: '选项', value: true }], disabled: true },
      radio: {
        options: [{ label: '选项', value: 'one' }],
        optionType: 'button',
        buttonStyle: 'solid',
      },
      number: { defaultValue: 2, step: 0.5, controls: false },
      switch: { defaultChecked: true, loading: true },
      datePicker: { defaultValue: '2026-10-13', showTime: true, minDate: '2026-01-01' },
      datePickerRange: {
        defaultStart: '2026-10-13',
        defaultEnd: '2026-10-15',
        startPlaceholder: '开始',
      },
      timePicker: { defaultValue: '09:30:00', hourStep: 2, use12Hours: true },
      cascader: {
        changeOnSelect: true,
        options: [{ label: '浙江', value: 'zj', children: [{ label: '杭州', value: 'hz' }] }],
      },
      treeSelect: {
        treeCheckable: true,
        treeData: [{ title: '部门', value: 'dept', children: [{ title: '小组', value: 'team' }] }],
      },
      upload: { action: '/upload', drag: true, listType: 'picture-circle', text: '上传文件' },
      slider: { range: true, defaultStart: 10, defaultEnd: 30, draggableTrack: true },
    };
    for (const [type, props] of Object.entries(inputs)) {
      schema.elements[`${type}_test`] = { type, props };
      schema.layout.structure.form_main!.push(`${type}_test`);
    }
    schema.elements.form_main!.props = {
      layout: 'horizontal',
      colon: true,
      preserve: true,
      labelAlign: 'right',
      labelColVal: 0,
      requiredMark: 'optional',
      initialValues: { name: '张三' },
      variant: 'filled',
      validateTrigger: 'onBlur',
    };
    const displays = {
      table: {
        rowKey: 'id',
        columns: [{ title: '姓名', dataIndex: 'name', width: 120, fixed: 'left' }],
        dataSource: [{ id: '1', name: '张三' }],
        pagination: { pageSize: 5, current: 1 },
        scrollY: 240,
      },
      tree: {
        checkable: true,
        defaultCheckedKeys: ['child'],
        treeData: [{ title: '部门', key: 'root', children: [{ title: '小组', key: 'child' }] }],
      },
      tabs: {
        items: [{ key: 'overview', label: '概览', children: '内容' }],
        tabPlacement: 'start',
        destroyOnHidden: true,
      },
      modal: { open: false, showFooter: false, destroyOnHidden: true },
      drawer: { open: false, placement: 'bottom', customSize: 240, resizable: true },
    };
    for (const [type, props] of Object.entries(displays)) {
      schema.elements[`${type}_test`] = { type, props };
      schema.layout.structure.element_root!.push(`${type}_test`);
    }
    expect(validatePageAgainstMaterials(schema, supportedSet)).toEqual({ valid: true, errors: [] });
  });

  it('reports unknown materials and props with stable diagnostics', () => {
    const schema = page();
    schema.elements.input_name = { type: 'mystery', props: {} };
    schema.elements.button_save!.props.extra = true;
    schema.elements.form_main!.props.layoutFixedWidth = -1;
    schema.elements.tabs_test = {
      type: 'tabs',
      props: { items: [{ key: '1', label: { unsafe: 'object' } }] },
    };
    schema.layout.structure.element_root!.push('tabs_test');
    const result = validatePageAgainstMaterials(schema, supportedSet);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'UNKNOWN_MATERIAL',
          path: '/elements/input_name/type',
          elementId: 'input_name',
          materialType: 'mystery',
        }),
        expect.objectContaining({
          code: 'INVALID_MATERIAL_PROPS',
          path: '/elements/button_save/props/extra',
          elementId: 'button_save',
          materialType: 'button',
        }),
        expect.objectContaining({ code: 'INVALID_MATERIAL_PROPS', elementId: 'tabs_test' }),
        expect.objectContaining({
          code: 'INVALID_MATERIAL_PROPS',
          elementId: 'form_main',
          path: '/elements/form_main/props/layoutFixedWidth',
        }),
      ]),
    );
  });

  it('rejects children on leaves and invalid parent-child combinations', () => {
    const schema = page();
    schema.layout.structure.button_save = ['form_main'];
    schema.layout.structure.element_root = ['input_name', 'button_save'];
    expect(codes(schema)).toEqual(
      expect.arrayContaining(['CHILDREN_NOT_ALLOWED', 'INVALID_PARENT']),
    );
  });

  it('rejects unknown events and broken bindings', () => {
    const schema = page();
    schema.bindElements = [
      { id: 'button_save', event: 'onHover', flowId: 'flow_save' },
      { id: 'missing', event: 'onClick', flowId: 'missing_flow' },
    ];
    expect(codes(schema)).toEqual(expect.arrayContaining(['UNKNOWN_EVENT', 'INVALID_BINDING']));
  });

  it('rejects executable expressions and unsafe URL schemes', () => {
    const schema = page();
    schema.elements.button_save!.props.href = 'javascript:alert(1)';
    schema.elements.upload_test = { type: 'upload', props: { action: 'javascript:alert(1)' } };
    schema.layout.structure.form_main!.push('upload_test');
    schema.flows.flow_save = {
      startId: 'node_start',
      nodes: {
        node_start: {
          id: 'node_start',
          type: 'start',
          prev: [],
          next: [],
          props: { condition: { type: 'expression', value: 'window.location' } },
        },
      },
    };
    expect(codes(schema)).toEqual(expect.arrayContaining(['UNSAFE_EXPRESSION', 'UNSAFE_URL']));
    expect(validatePageAgainstMaterials(schema, supportedSet).errors).toContainEqual(
      expect.objectContaining({ code: 'UNSAFE_URL', path: '/elements/upload_test/props/action' }),
    );
  });

  it('rejects a project/runtime material version mismatch', () => {
    expect(codes(page(), [{ id: 'official-antd', version: '0.9.0' }])).toContain(
      'MATERIAL_SET_VERSION_MISMATCH',
    );
    const mismatchedRuntime: MaterialValidationRuntime = {
      ...defaultMaterialValidationRuntime,
      materialSet: { id: 'official-antd', version: '9.0.0' },
    };
    expect(
      validatePageAgainstMaterials(page(), supportedSet, mismatchedRuntime).errors[0],
    ).toMatchObject({
      code: 'MATERIAL_SET_VERSION_MISMATCH',
      path: '/materialSets',
    });
    const mismatchedManifest: MaterialValidationRuntime = {
      ...defaultMaterialValidationRuntime,
      registry: {
        ...defaultMaterialValidationRuntime.registry,
        button: { ...defaultMaterialValidationRuntime.registry.button!, version: '0.9.0' },
      },
    };
    expect(validatePageAgainstMaterials(page(), supportedSet, mismatchedManifest).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'MATERIAL_SET_VERSION_MISMATCH',
          path: '/materials/button/version',
          materialType: 'button',
        }),
      ]),
    );
  });
});
