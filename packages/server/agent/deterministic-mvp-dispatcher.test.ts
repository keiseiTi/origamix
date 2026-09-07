import { describe, expect, it } from 'vitest';
import { validatePage } from '@origamix/shared/protocol/validation';
import {
  defaultMaterialValidationRuntime,
  validatePageAgainstMaterials,
} from '../services/schema-material-validation';
import { deterministicRunMode, deterministicSchema } from './deterministic-mvp-dispatcher';

describe('deterministic MVP dispatcher routing', () => {
  it('separates low-code questions, modifications and unrelated prompts', () => {
    expect(deterministicRunMode('今天天气怎么样')).toBe('out_of_scope');
    expect(deterministicRunMode('表格在搭建器里如何配置')).toBe('page_question');
    expect(deterministicRunMode('能否把按钮改成主要按钮？')).toBe('page_modify');
    expect(deterministicRunMode('加一个天气')).toBe('clarification_required');
    expect(deterministicRunMode('创建一个天气展示页面')).toBe('page_modify');
    expect(deterministicRunMode('创建一个客户信息表单')).toBe('page_modify');
  });

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
