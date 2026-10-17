import { createEngine, type Schema } from '@tangramino/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { logicNodes, resolveFlowValue } from '../logic-nodes';

const schema: Schema = {
  elements: {
    root: { type: 'container', props: {} },
    button: { type: 'button', props: {} },
    form: { type: 'form', props: {} },
    modal: { type: 'modal', props: {} },
  },
  layout: { root: 'root', structure: { root: ['button', 'form', 'modal'] } },
  extensions: {},
};
afterEach(() => vi.unstubAllGlobals());

describe('declarative event execution', () => {
  // Runtime owns execution: Server cannot prove that preview actions use values
  // and targets from the current page instead of evaluating project code.
  it('executes the configured property, variable, method and portal actions with scoped data references', async () => {
    const engine = createEngine(schema);
    const context = { engine, data: {}, lastReturnedVal: { request: { data: { text: '完成' } } } };
    logicNodes.setGlobalVariable!({
      ...context,
      data: { setters: [{ name: 'show', value: false }] },
    });
    logicNodes.setElementProps!({
      ...context,
      data: {
        setters: [
          {
            elementId: 'button',
            propName: 'text',
            value: { $ref: 'result', name: 'request', path: 'data.text' },
          },
        ],
      },
    });
    expect(engine.elements.button?.props.text).toBe('完成');
    expect(
      logicNodes.condition!({ ...context, data: { judgment: { $ref: 'global', name: 'show' } } }),
    ).toBe(false);
    const method = vi.fn();
    engine.setContextValue('form', { resetFields: method });
    await logicNodes.emitElementAction!({
      ...context,
      data: {
        setters: [
          { elementId: 'form', methodName: 'resetFields', value: ['value'] },
          { elementId: 'form', methodName: 'constructor', value: [] },
        ],
      },
    });
    expect(method).toHaveBeenCalledExactlyOnceWith('value');
    logicNodes.openModalDrawer!({ ...context, data: { elementId: 'modal' } });
    expect(engine.elements.modal?.props.open).toBe(true);
    logicNodes.closeModalDrawer!({ ...context, data: { elementId: 'modal' } });
    expect(engine.elements.modal?.props.open).toBe(false);
    expect(
      resolveFlowValue(context, { $ref: 'result', name: 'request', path: '__proto__.constructor' }),
    ).toBeUndefined();
  });

  it('keeps custom scripts inert and requests free of implicit host credentials', async () => {
    const engine = createEngine(schema);
    const request = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ value: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', request);
    const result = await logicNodes.interfaceRequest!({
      engine,
      data: { url: 'https://example.test/data', method: 'post', bodyParams: { test: true } },
    });
    expect(result).toMatchObject({ ok: true, status: 200, data: { value: 1 } });
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'omit',
      redirect: 'error',
      body: '{"test":true}',
    });
    expect((request.mock.calls[0]?.[1].headers as Headers).has('authorization')).toBe(false);
    expect(
      await logicNodes.interfaceRequest!({ engine, data: { url: 'javascript:alert(1)' } }),
    ).toMatchObject({ ok: false, status: 0 });
    expect(request).toHaveBeenCalledTimes(1);
    const execute = vi.fn();
    vi.stubGlobal('executeProjectCode', execute);
    expect(logicNodes.customJS!({ engine, data: { code: 'executeProjectCode()' } })).toMatchObject({
      supported: false,
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
