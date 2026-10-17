import type { FlowExecuteContext, LogicNodes } from '@tangramino/engine';
import { isFlowNodeProps, type FlowNodeProps, type RuntimeFlowNodeType } from '@origamix/shared';

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
const safeKey = (value: string): boolean =>
  !['__proto__', 'prototype', 'constructor'].includes(value);

/** Only explicit data references are resolved; project strings are never evaluated. */
export const resolveFlowValue = (context: Context, value: unknown): unknown => {
  const reference = record(value);
  if (reference.$ref !== 'global' && reference.$ref !== 'result') return value;
  if (typeof reference.name !== 'string' || !safeKey(reference.name)) return undefined;
  let resolved =
    reference.$ref === 'global'
      ? context.engine.getGlobalVariable(reference.name)
      : context.lastReturnedVal?.[reference.name];
  for (const part of String(reference.path ?? '')
    .split('.')
    .filter(Boolean)) {
    if (
      !safeKey(part) ||
      resolved === null ||
      typeof resolved !== 'object' ||
      !Object.hasOwn(resolved, part)
    )
      return undefined;
    resolved = (resolved as Record<string, unknown>)[part];
  }
  return resolved;
};
const elementId = (context: Context, value: unknown): string | undefined =>
  typeof value === 'string' && safeKey(value) && Object.hasOwn(context.engine.elements, value)
    ? value
    : undefined;
const portal =
  (open: boolean) =>
  (context: NodeContext<'openModalDrawer' | 'closeModalDrawer'>): void => {
    const id = elementId(context, context.data.elementId);
    if (id && ['modal', 'drawer'].includes(context.engine.elements[id]!.type))
      context.engine.setState({ [id]: { open } });
  };

/** Declarative actions shared by preview and generated projects. */
const handlers: NodeHandlers = {
  setElementProps: (context) => {
    const { engine, data } = context;
    for (const setter of data.setters) {
      const id = elementId(context, setter.elementId);
      if (id && typeof setter.propName === 'string' && setter.propName && safeKey(setter.propName))
        engine.setState({ [id]: { [setter.propName]: resolveFlowValue(context, setter.value) } });
    }
  },
  visibleElement: (context) => {
    const { engine, data } = context;
    const ids = data.elementIds
      .map((id) => elementId(context, id))
      .filter((id): id is string => Boolean(id));
    const visible = resolveFlowValue(context, data.value ?? true);
    if (visible === false) engine.hiddenElements(ids);
    else engine.showElements(ids);
  },
  setGlobalVariable: (context) => {
    const entries = context.data.setters;
    for (const setter of entries)
      if (typeof setter.name === 'string' && setter.name && safeKey(setter.name))
        context.engine.setGlobalVariable(setter.name, resolveFlowValue(context, setter.value));
  },
  emitElementAction: (context) => {
    const results: unknown[] = [];
    for (const setter of context.data.setters) {
      const id = elementId(context, setter.elementId);
      if (!id || typeof setter.methodName !== 'string' || !safeKey(setter.methodName)) continue;
      const values = context.engine.getContextValue(id);
      if (!values || !Object.hasOwn(values, setter.methodName)) continue;
      const method = values[setter.methodName];
      if (typeof method !== 'function') continue;
      const value = resolveFlowValue(context, setter.value);
      results.push(method(...(Array.isArray(value) ? value : [value])));
    }
    return Promise.allSettled(results);
  },
  openModalDrawer: portal(true),
  closeModalDrawer: portal(false),
  condition: (context) => {
    const left = resolveFlowValue(context, context.data.judgment);
    const right = resolveFlowValue(context, context.data.compareValue);
    switch (context.data.operator) {
      case 'equals':
        return JSON.stringify(left) === JSON.stringify(right);
      case 'notEquals':
        return JSON.stringify(left) !== JSON.stringify(right);
      case 'greater':
        return typeof left === 'number' && typeof right === 'number' && left > right;
      case 'less':
        return typeof left === 'number' && typeof right === 'number' && left < right;
      default:
        return Boolean(left);
    }
  },
  interfaceRequest: async (context) => {
    try {
      const { data } = context;
      const url = new URL(String(resolveFlowValue(context, data.url)));
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
        throw new Error('请求地址必须使用 HTTP 或 HTTPS');
      const method = String(data.method ?? 'get').toUpperCase();
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method))
        throw new Error('不支持的请求方法');
      for (const [key, value] of Object.entries(
        record(resolveFlowValue(context, data.queryParams)),
      ))
        url.searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      const headers = new Headers();
      for (const [key, value] of Object.entries(record(resolveFlowValue(context, data.headers))))
        if (typeof value === 'string') headers.set(key, value);
      const body = resolveFlowValue(context, data.bodyParams);
      if (method !== 'GET' && body !== null && body !== undefined && !headers.has('content-type'))
        headers.set('content-type', 'application/json');
      const response = await fetch(url, {
        method,
        headers,
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(Math.max(100, Math.min(60000, Number(data.timeout) || 10000))),
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
  // Configuration is retained, but project-provided scripts are deliberately inert.
  customJS: () => ({ supported: false, error: '自定义 JS 当前仅保存配置，暂不执行' }),
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
