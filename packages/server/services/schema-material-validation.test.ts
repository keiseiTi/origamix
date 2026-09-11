import { describe, expect, it } from 'vitest';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import {
  defaultMaterialValidationRuntime,
  validatePageAgainstMaterials,
  type MaterialValidationRuntime,
} from './schema-material-validation';

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
    flows: { flow_save: { startId: 'node_start', nodes: {} } },
    bindElements: [{ id: 'button_save', event: 'onClick', flowId: 'flow_save' }],
    context: { globalVariables: [] },
    extensions: { origamix: { schemaVersion: '1.0' } },
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
    expect(validatePageAgainstMaterials(page(), supportedSet)).toEqual({ valid: true, errors: [] });
  });

  it('reports unknown materials and props with stable diagnostics', () => {
    const schema = page();
    schema.elements.input_name = { type: 'mystery', props: {} };
    schema.elements.button_save!.props.extra = true;
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
    schema.flows.flow_save = {
      startId: 'node_start',
      nodes: {
        node_start: { props: { condition: { type: 'expression', value: 'window.location' } } },
      },
    };
    expect(codes(schema)).toEqual(expect.arrayContaining(['UNSAFE_EXPRESSION', 'UNSAFE_URL']));
  });

  it('rejects a project/runtime material version mismatch', () => {
    expect(codes(page(), [{ id: 'official-antd', version: '0.9.0' }])).toContain(
      'MATERIAL_SET_VERSION_MISMATCH',
    );
    const mismatchedRuntime: MaterialValidationRuntime = {
      ...defaultMaterialValidationRuntime,
      materialSet: { id: 'official-antd', version: '2.0.0' },
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
