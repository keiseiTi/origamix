import { createEngine, type Schema } from '@tangramino/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flowNodeManifests, getFlowNodeManifest } from '@origamix/shared';
import { createLogicNodes, logicNodes } from '../logic-nodes';
import { executeHyperValue, resolveHyperContext } from '../execute';

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
  // Runtime owns page execution; Server cannot verify resolved bindings or code results.
  it('executes the configured property, variable, method and portal actions with scoped data references', async () => {
    expect(Object.keys(logicNodes).sort()).toEqual(
      flowNodeManifests
        .filter((node) => node.type !== 'start')
        .map((node) => node.type)
        .sort(),
    );
    const engine = createEngine(schema);
    expect(() =>
      logicNodes.setElementProps!({
        engine,
        data: { elementId: 'button', value: { text: 'invalid' } },
      }),
    ).toThrow('Invalid flow node properties');
    expect(engine.elements.button?.props.text).toBeUndefined();
    const context = { engine, data: {}, lastReturnedVal: { request: { data: { text: '完成' } } } };
    await logicNodes.setGlobalVariable!({
      ...context,
      data: { setters: [{ name: 'show', value: { type: 'boolean', value: false } }] },
    });
    await logicNodes.setElementProps!({
      ...context,
      data: {
        setters: [
          {
            elementId: 'button',
            propName: 'text',
            value: { type: 'contextValue', value: 'result.request.data.text' },
          },
        ],
      },
    });
    expect(engine.elements.button?.props.text).toBe('完成');
    expect(
      await logicNodes.condition!({
        ...context,
        data: {
          ...getFlowNodeManifest('condition')!.defaultProps,
          judgment: { type: 'contextValue', value: 'global.show' },
        },
      }),
    ).toBe(false);
    const method = vi.fn();
    engine.setContextValue('form', { resetFields: method });
    await logicNodes.emitElementAction!({
      ...context,
      data: {
        setters: [
          {
            elementId: 'form',
            methodName: 'resetFields',
            value: { type: 'function', value: { params: [], body: 'return ["value"];' } },
          },
          { elementId: 'form', methodName: 'constructor', value: { type: 'null', value: null } },
        ],
      },
    });
    expect(method).toHaveBeenCalledExactlyOnceWith(['value']);
    logicNodes.openModalDrawer!({ ...context, data: { elementId: 'modal' } });
    expect(engine.elements.modal?.props.open).toBe(true);
    logicNodes.closeModalDrawer!({ ...context, data: { elementId: 'modal' } });
    expect(engine.elements.modal?.props.open).toBe(false);
    expect(() => resolveHyperContext(context, 'result.request.__proto__.constructor')).toThrow(
      'Invalid context reference',
    );
    expect(executeHyperValue(context, { type: 'expression', value: '1 + 2' })).toBe(3);
    expect(
      executeHyperValue(context, {
        type: 'function',
        value: {
          params: [{ name: 'text', value: 'state.button.text' }],
          body: 'return text + "!";',
        },
      }),
    ).toBe('完成!');
    await expect(
      logicNodes.setElementProps!({
        ...context,
        data: {
          setters: [
            {
              elementId: 'button',
              propName: 'text',
              value: { type: 'string', value: 'must not apply' },
            },
            {
              elementId: 'button',
              propName: 'disabled',
              value: { type: 'expression', value: '(' },
            },
          ],
        },
      }),
    ).rejects.toThrow();
    expect(engine.elements.button?.props.text).toBe('完成');
    const report = vi.fn();
    const guarded = createLogicNodes(report);
    const invocation = { engine, lastReturnedVal: {} };
    await guarded.customJS!({
      ...invocation,
      data: {
        value: {
          type: 'function',
          value: { params: [], body: 'throw new Error("script failed");' },
        },
      },
    });
    await guarded.setElementProps!({
      ...invocation,
      data: {
        setters: [
          {
            elementId: 'button',
            propName: 'text',
            value: { type: 'string', value: 'must be skipped' },
          },
        ],
      },
    });
    expect(report).toHaveBeenCalledOnce();
    expect(engine.elements.button?.props.text).toBe('完成');
    await guarded.setElementProps!({
      ...invocation,
      lastReturnedVal: {},
      data: {
        setters: [
          {
            elementId: 'button',
            propName: 'text',
            value: { type: 'string', value: 'retry succeeded' },
          },
        ],
      },
    });
    expect(engine.elements.button?.props.text).toBe('retry succeeded');
    await logicNodes.visibleElement!({
      ...context,
      data: { elementIds: ['button'], value: { type: 'boolean', value: false } },
    });
    expect(engine.elements.button?.hidden).toBe(true);
  });

  it('executes function values and keeps requests free of implicit host credentials', async () => {
    const engine = createEngine(schema);
    const request = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ value: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', request);
    const result = await logicNodes.interfaceRequest!({
      engine,
      data: {
        ...getFlowNodeManifest('interfaceRequest')!.defaultProps,
        url: { type: 'expression', value: '"https://example.test/data"' },
        method: 'post',
        headers: { type: 'function', value: { params: [], body: 'return { "x-page": "hyper" };' } },
        queryParams: { type: 'function', value: { params: [], body: 'return { page: 2 };' } },
        bodyParams: {
          type: 'function',
          value: { params: [], body: 'return Promise.resolve({ test: true });' },
        },
      },
    });
    expect(result).toMatchObject({ ok: true, status: 200, data: { value: 1 } });
    expect(String(request.mock.calls[0]?.[0])).toBe('https://example.test/data?page=2');
    expect((request.mock.calls[0]?.[1].headers as Headers).get('x-page')).toBe('hyper');
    expect(request.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'omit',
      redirect: 'error',
      body: '{"test":true}',
    });
    expect((request.mock.calls[0]?.[1].headers as Headers).has('authorization')).toBe(false);
    expect(
      await logicNodes.interfaceRequest!({
        engine,
        data: {
          ...getFlowNodeManifest('interfaceRequest')!.defaultProps,
          url: { type: 'string', value: 'javascript:alert(1)' },
        },
      }),
    ).toMatchObject({ ok: false, status: 0 });
    expect(request).toHaveBeenCalledTimes(1);
    expect(
      await logicNodes.customJS!({
        engine,
        data: { value: { type: 'function', value: { params: [], body: 'return 42;' } } },
      }),
    ).toBe(42);
    expect(() =>
      executeHyperValue(
        { engine, data: {} },
        {
          type: 'function',
          value: {
            params: [
              { name: 'x', value: 'global.x' },
              { name: 'x', value: 'global.y' },
            ],
            body: 'return x;',
          },
        },
      ),
    ).toThrow('unique');
  });
});
