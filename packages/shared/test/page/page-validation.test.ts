import { ORIGAMIX_VERSION } from '@origamix/shared';
import { describe, expect, it } from 'vitest';
import {
  validatePage,
  isPageSchema,
  validateSchemaOperation,
  validateSchemaOperationBatch,
} from '../../src/page/page-validation.ts';

const emptyPage = {
  elements: { element_root: { type: 'container', props: {} } },
  layout: { root: 'element_root', structure: { element_root: [] } },
  flows: {},
  bindElements: [],
  context: { globalVariables: [] },
  extensions: { origamix: { schemaVersion: ORIGAMIX_VERSION } },
};

describe('page protocol validation', () => {
  it('accepts the canonical empty page', () => {
    expect(isPageSchema(emptyPage)).toBe(true);
    expect(isPageSchema({ ...emptyPage, layout: { ...emptyPage.layout, root: 'missing' } })).toBe(
      false,
    );
    expect(isPageSchema({ ...emptyPage, elements: null })).toBe(false);
    expect(validatePage(emptyPage)).toEqual({ valid: true, errors: [], semanticErrors: [] });
  });

  it('accepts material-prefixed element IDs', () => {
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

  it('requires typed flows and event bindings in pages and operations', () => {
    const flow = {
      startId: 'start',
      nodes: { start: { id: 'start', type: 'start', props: {}, prev: [], next: [] } },
    };
    const binding = { id: 'element_root', event: 'init', flowId: 'flow_init' };
    expect(
      validatePage({ ...emptyPage, flows: { flow_init: flow }, bindElements: [binding] }).valid,
    ).toBe(true);
    expect(validateSchemaOperation({ operation: 'addFlow', flowId: 'flow_init', flow }).valid).toBe(
      true,
    );
    expect(
      validateSchemaOperation({ operation: 'addFlow', flowId: 'flow_init', flow: { nodes: [] } })
        .valid,
    ).toBe(false);
    expect(
      validatePage({ ...emptyPage, bindElements: [{ ...binding, elementId: 'element_root' }] })
        .valid,
    ).toBe(false);
    expect(validatePage({ ...emptyPage, flows: { constructor: flow } }).valid).toBe(false);
    expect(
      validateSchemaOperation({
        operation: 'setElementEventBinding',
        elementId: 'element_root',
        event: 'init',
        flowId: 'flow_init',
      }).valid,
    ).toBe(true);
    expect(
      validateSchemaOperation({
        operation: 'removeElementEventBinding',
        elementId: 'element_root',
        event: '',
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
