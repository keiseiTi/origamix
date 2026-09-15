import { describe, expect, it } from 'vitest';
import { validatePage } from '@origamix/shared/protocol/validation';
import {
  defaultMaterialValidationRuntime,
  validatePageAgainstMaterials,
} from '../schema/material-validation';
import { deterministicSchema } from './deterministic-engine';

describe('deterministic Schema fixtures', () => {
  it('builds a valid form-and-table candidate through the approved material set', () => {
    const schema = deterministicSchema(
      {
        elements: { element_root: { type: 'container', props: {} } },
        layout: { root: 'element_root', structure: { element_root: [] } },
        flows: {},
        bindElements: [],
        context: { globalVariables: [] },
        extensions: { origamix: { schemaVersion: '1.0' } },
      },
      '创建客户表单和表格',
      'run_candidate01',
    );
    expect(validatePage(schema).valid).toBe(true);
    expect(
      validatePageAgainstMaterials(schema, [defaultMaterialValidationRuntime.materialSet]).valid,
    ).toBe(true);
    expect(Object.values(schema.elements).map((element) => element.type)).toEqual(
      expect.arrayContaining(['form', 'input', 'button', 'table']),
    );
  });
});
