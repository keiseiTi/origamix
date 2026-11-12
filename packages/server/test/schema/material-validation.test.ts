import {
  SCHEMA_VERSION,
  MATERIAL_CONTRACT_VERSION,
  type OrigamixPageSchema,
  type ValidationMaterialManifest,
} from '@origamix/shared';
import { describe, expect, it } from 'vitest';
import { validatePageAgainstMaterials } from '../../src/schema/validation/material-validation';
import type { MaterialValidationRuntime } from '../../src/schema/validation/validation-contracts';

// Stable protocol fixtures: material UI configuration must not change generic validator tests.
const manifest = (type: string, acceptsChildren = false): ValidationMaterialManifest => ({
  type,
  version: MATERIAL_CONTRACT_VERSION,
  acceptsChildren,
  role: 'input',
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      text: { type: 'string' },
      href: { type: 'string' },
      count: { type: 'integer', minimum: 0 },
    },
  },
  context: { variables: [], writable: [], actions: [], events: [{ name: 'onClick' }] },
});
const runtime: MaterialValidationRuntime = {
  materialSet: { id: 'test-materials', version: MATERIAL_CONTRACT_VERSION },
  registry: {
    root: manifest('root', true),
    leaf: { ...manifest('leaf'), allowedParentTypes: ['root'] },
    overlay: { ...manifest('overlay', true), role: 'overlay' },
  },
};
const sets = [runtime.materialSet];
const page = (): OrigamixPageSchema => ({
  elements: {
    root: { type: 'root', props: {} },
    child: { type: 'leaf', props: { text: '保存', href: '/saved' } },
  },
  layout: { root: 'root', structure: { root: ['child'], child: [] } },
  flows: {
    save: {
      startId: 'start',
      nodes: { start: { id: 'start', type: 'start', props: {}, prev: [], next: [] } },
    },
  },
  bindElements: [{ id: 'child', event: 'onClick', flowId: 'save' }],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: SCHEMA_VERSION } },
});
const validate = (schema: OrigamixPageSchema) =>
  validatePageAgainstMaterials(schema, sets, runtime);

describe('Manifest-driven Schema validation', () => {
  it('accepts declared props, hierarchy, events and safe URLs', () => {
    expect(validate(page())).toEqual({ valid: true, errors: [] });
  });
  it('reports unknown materials, fields and invalid types with stable diagnostics', () => {
    const schema = page();
    schema.elements.root!.props.count = -1;
    schema.elements.child!.props.extra = true;
    schema.elements.unknown = { type: 'missing', props: {} };
    expect(validate(schema).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'INVALID_MATERIAL_PROPS',
          path: '/elements/root/props/count',
        }),
        expect.objectContaining({
          code: 'INVALID_MATERIAL_PROPS',
          path: '/elements/child/props/extra',
        }),
        expect.objectContaining({ code: 'UNKNOWN_MATERIAL', path: '/elements/unknown/type' }),
      ]),
    );
    schema.elements.root!.props.count = '1';
    expect(validate(schema).errors).toContainEqual(
      expect.objectContaining({ code: 'INVALID_MATERIAL_PROPS', elementId: 'root' }),
    );
  });
  it('rejects children on leaves and enforces declared parent and overlay capabilities', () => {
    const schema = page();
    schema.elements.panel = { type: 'overlay', props: {} };
    schema.layout.structure.child = ['panel'];
    expect(validate(schema).errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['CHILDREN_NOT_ALLOWED', 'INVALID_PARENT']),
    );
    schema.layout.structure.child = [];
    schema.layout.structure.root!.push('panel');
    expect(validate(schema).valid).toBe(true);
    schema.layout.structure.panel = ['child'];
    schema.layout.structure.root = ['panel'];
    expect(validate(schema).errors.map((error) => error.code)).toContain('INVALID_PARENT');
  });
  it('rejects unknown events and broken bindings', () => {
    const schema = page();
    schema.bindElements = [
      { id: 'child', event: 'onHover', flowId: 'save' },
      { id: 'missing', event: 'onClick', flowId: 'absent' },
    ];
    expect(validate(schema).errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['UNKNOWN_EVENT', 'INVALID_BINDING']),
    );
  });
  it('rejects executable property values and unsafe URLs without executing flow code', () => {
    const schema = page();
    schema.elements.child!.props.href = 'javascript:alert(1)';
    schema.elements.child!.props.text = {
      type: 'function',
      value: { body: 'throw new Error("must not execute")', params: [] },
    };
    expect(validate(schema).errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['UNSAFE_EXPRESSION', 'UNSAFE_URL']),
    );
    schema.elements.child!.props = {};
    schema.flows.save = {
      startId: 'script',
      nodes: {
        script: {
          id: 'script',
          type: 'customJS',
          prev: [],
          next: [],
          props: {
            value: {
              type: 'function',
              value: { params: [], body: 'throw new Error("must not execute")' },
            },
          },
        },
      },
    };
    expect(validate(schema).valid).toBe(true);
  });
  it('rejects catalog versions that do not match the project or installed set', () => {
    expect(
      validatePageAgainstMaterials(page(), [{ ...runtime.materialSet, version: '0.0.0' }], runtime)
        .errors[0]?.code,
    ).toBe('MATERIAL_SET_VERSION_MISMATCH');
    expect(
      validatePageAgainstMaterials(page(), sets, {
        ...runtime,
        registry: { ...runtime.registry, leaf: { ...runtime.registry.leaf!, version: '0.0.0' } },
      }).errors,
    ).toContainEqual(
      expect.objectContaining({
        code: 'MATERIAL_SET_VERSION_MISMATCH',
        path: '/materials/leaf/version',
      }),
    );
  });
});

// Page navigation cannot target a page outside the owning project.
it('validates page navigation against project page IDs before accepting a schema', () => {
  const schema = page();
  schema.flows.save = {
    startId: 'go',
    nodes: {
      go: { id: 'go', type: 'navigatePage', props: { pageId: 'page_home' }, prev: [], next: [] },
    },
  };
  const navigationRuntime = {
    ...runtime,
    navigation: { pages: [{ pageId: 'page_home', name: '首页' }] },
  };
  expect(validatePageAgainstMaterials(schema, sets, navigationRuntime).valid).toBe(true);
  expect(validatePageAgainstMaterials(schema, sets, runtime).valid).toBe(false);
  schema.flows.save.nodes.go!.props = { pageId: 'page_foreign' };
  expect(validatePageAgainstMaterials(schema, sets, navigationRuntime).errors).toContainEqual(
    expect.objectContaining({
      code: 'INVALID_FLOW_REFERENCE',
      path: '/flows/save/nodes/go/props/pageId',
    }),
  );
});
