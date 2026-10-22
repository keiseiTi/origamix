import { assertRuntimeField, assertRuntimeMethod, writeRuntimeState } from './material-state';
import type { FlowExecuteContext, LogicNodes } from '@tangramino/engine';
import { isFlowNodeProps, type FlowNodeProps, type RuntimeFlowNodeType } from '@origamix/shared';

import { executeHyperValue } from './execute';

type Context = FlowExecuteContext<Record<string, unknown>>;
type NodeContext<T extends RuntimeFlowNodeType> = Omit<Context, 'data'> & {
  data: FlowNodeProps<T>;
};
type NodeHandlers = {
  [T in RuntimeFlowNodeType]: (context: NodeContext<T>) => unknown;
};
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const requestRecord = (value: unknown, field: string): Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${field} must resolve to an object`);
  return record(value);
};
const safeKey = (value: string): boolean =>
  !['__proto__', 'prototype', 'constructor'].includes(value);

const elementId = (context: Context, value: unknown): string | undefined =>
  typeof value === 'string' && safeKey(value) && Object.hasOwn(context.engine.elements, value)
    ? value
    : undefined;
const portal =
  (open: boolean) =>
  (context: NodeContext<'openModalDrawer' | 'closeModalDrawer'>): void => {
    const id = elementId(context, context.data.elementId);
    if (id && ['modal', 'drawer'].includes(context.engine.elements[id]!.type)) {
      writeRuntimeState(context.engine, id, { open });
      context.engine.setState({ [id]: { open } });
    }
  };

/** Declarative actions shared by preview and generated projects. */
const handlers: NodeHandlers = {
  setElementProps: async (context) => {
    const { engine, data } = context;
    const changes: Record<string, Record<string, unknown>> = {};
    for (const setter of data.setters) {
      const id = elementId(context, setter.elementId);
      if (
        id &&
        typeof setter.propName === 'string' &&
        setter.propName &&
        safeKey(setter.propName)
      ) {
        assertRuntimeField(engine, id, setter.propName, true);
        changes[id] = {
          ...changes[id],
          [setter.propName]: await executeHyperValue(context, setter.value),
        };
      }
    }
    for (const [id, patch] of Object.entries(changes)) writeRuntimeState(engine, id, patch);
    for (const [id, patch] of Object.entries(changes)) {
      const writeField = engine.getContextValue(id)?.$writeField;
      const field = engine.elements[id]?.type === 'switch' ? 'checked' : 'value';
      if (typeof writeField === 'function' && Object.hasOwn(patch, field)) writeField(patch[field]);
    }
    engine.setState(changes);
  },
  visibleElement: async (context) => {
    const { engine, data } = context;
    const ids = data.elementIds
      .map((id) => elementId(context, id))
      .filter((id): id is string => Boolean(id));
    const visible = await executeHyperValue(context, data.value);
    if (visible === false) engine.hiddenElements(ids);
    else engine.showElements(ids);
  },
  setGlobalVariable: async (context) => {
    const entries = context.data.setters;
    const changes: [string, unknown][] = [];
    for (const setter of entries)
      if (typeof setter.name === 'string' && setter.name && safeKey(setter.name))
        changes.push([setter.name, await executeHyperValue(context, setter.value)]);
    for (const [name, value] of changes) context.engine.setGlobalVariable(name, value);
  },
  emitElementAction: async (context) => {
    const results: unknown[] = [];
    for (const setter of context.data.setters) {
      const id = elementId(context, setter.elementId);
      if (!id || typeof setter.methodName !== 'string' || !safeKey(setter.methodName)) continue;
      assertRuntimeMethod(context.engine, id, setter.methodName);
      const values = context.engine.getContextValue(id);
      if (!values || !Object.hasOwn(values, setter.methodName)) continue;
      const method = values[setter.methodName];
      if (typeof method !== 'function') continue;
      const value = await executeHyperValue(context, setter.value);
      results.push(Promise.resolve().then(() => method(value)));
    }
    return Promise.allSettled(results);
  },
  openModalDrawer: portal(true),
  closeModalDrawer: portal(false),
  condition: async (context) => Boolean(await executeHyperValue(context, context.data.judgment)),
  interfaceRequest: async (context) => {
    try {
      const { data } = context;
      const url = new URL(String(await executeHyperValue(context, data.url)));
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        throw new Error('请求地址必须使用 HTTP 或 HTTPS');
      const method = String(data.method ?? 'get').toUpperCase();
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method))
        throw new Error('不支持的请求方法');
      for (const [key, value] of Object.entries(
        requestRecord(await executeHyperValue(context, data.queryParams), 'queryParams'),
      ))
        url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      const headers = new Headers();
      for (const [key, value] of Object.entries(
        requestRecord(await executeHyperValue(context, data.headers), 'headers'),
      )) {
        if (typeof value !== 'string') throw new Error('Header values must be strings');
        headers.set(key, value);
      }
      const body = await executeHyperValue(context, data.bodyParams);
      if (method !== 'GET' && body !== null && body !== undefined && !headers.has('content-type'))
        headers.set('content-type', 'application/json');
      const response = await fetch(url, {
        method,
        headers,
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        ...(method !== 'GET' && body !== null && body !== undefined
          ? { body: JSON.stringify(body) }
          : {}),
      });
      const text = await response.text();
      let result: unknown = text;
      try {
        result = text ? JSON.parse(text) : null;
      } catch {
        /* Preserve text responses as data. */
      }
      return {
        ok: response.ok,
        status: response.status,
        data: result,
        error: response.ok ? null : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: null,
        error: error instanceof Error ? error.message : '接口请求失败',
      };
    }
  },
  customJS: (context) => executeHyperValue(context, context.data.value),
};

// The Engine accepts untyped data. Validate it before entering a typed handler.
const registerNode =
  <T extends RuntimeFlowNodeType>(type: T) =>
  (context: Context): unknown => {
    const data = context.data;
    if (!isFlowNodeProps(type, data)) throw new Error(`Invalid flow node properties: ${type}`);
    return handlers[type]({ ...context, data });
  };

export const logicNodes: LogicNodes = Object.fromEntries(
  (Object.keys(handlers) as RuntimeFlowNodeType[]).map((type) => [type, registerNode(type)]),
);

/** Engine does not catch rejected actions. Stop this invocation and report its failure. */
export const createLogicNodes = (onError: (error: unknown) => void): LogicNodes => {
  const stopped = new WeakSet<object>();
  return Object.fromEntries(
    Object.entries(logicNodes).map(([type, handler]) => [
      type,
      async (context: Context) => {
        const run = context.lastReturnedVal;
        if (run && stopped.has(run)) return;
        try {
          return await handler(context);
        } catch (error) {
          if (run) stopped.add(run);
          onError(error);
          return undefined;
        }
      },
    ]),
  );
};
