import { describe, expect, it } from 'vitest';
import {
  validatePage,
  validateSchemaOperation,
  validateSchemaOperationBatch,
} from '../../src/protocol/validation';

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

  it('accepts Tangramino-generated material IDs', () => {
    const result = validatePage({
      ...emptyPage,
      elements: {
        ...emptyPage.elements,
        'button-Ab12_cd3': { type: 'button', props: { text: '按钮' } },
      },
      layout: {
        ...emptyPage.layout,
        structure: { element_root: ['button-Ab12_cd3'] },
      },
    });
    expect(result.valid).toBe(true);
  });

  it('rejects an unsafe element ID', () => {
    const result = validatePage({
      ...emptyPage,
      layout: { ...emptyPage.layout, root: '../button' },
    });
    expect(result.valid).toBe(false);
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

  it('validates a typed Schema operation', () => {
    expect(
      validateSchemaOperation({
        operation: 'updateElementProps',
        elementId: 'button_submit',
        set: { children: '提交订单' },
        unset: ['loading'],
      }).valid,
    ).toBe(true);
    expect(
      validateSchemaOperation({
        operation: 'updateElementProps',
        elementId: '../button',
        set: { children: '提交订单' },
      }).valid,
    ).toBe(false);
  });

  it('requires a bounded, page-scoped operation batch', () => {
    const batch = {
      version: '1',
      pageId: 'page_orders',
      baseWorkingVersion: 3,
      clientRequestId: 'request_1',
      source: { kind: 'agent', runId: 'run_1', messageId: 'message_1' },
      operations: [
        {
          operation: 'addElement',
          elementId: 'button_submit',
          element: { type: 'button', props: {} },
          parentId: 'element_root',
        },
      ],
      createdAt: '2026-09-17T00:00:00.000Z',
    };
    expect(validateSchemaOperationBatch(batch).valid).toBe(true);
    expect(validateSchemaOperationBatch({ ...batch, operations: [] }).valid).toBe(false);
    expect(validateSchemaOperationBatch({ ...batch, baseWorkingVersion: 0 }).valid).toBe(false);
    expect(
      validateSchemaOperationBatch({ ...batch, pageId: 'page_other', extra: true }).valid,
    ).toBe(false);
  });
});
