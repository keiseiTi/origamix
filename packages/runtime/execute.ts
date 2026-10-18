import type { HyperValue } from '@origamix/shared';
import type { FlowExecuteContext } from '@tangramino/engine';

type Context = FlowExecuteContext<Record<string, unknown>>;
const safe = (key: string): boolean => !['__proto__', 'prototype', 'constructor'].includes(key);
const readPath = (source: unknown, path: string[]): unknown => {
  let value = source;
  for (const key of path) {
    if (!safe(key) || value === null || typeof value !== 'object' || !Object.hasOwn(value, key))
      throw new Error('Invalid context reference');
    value = (value as Record<string, unknown>)[key];
  }
  return value;
};

/** Explicit bindings share one namespace across the input picker and function parameters. */
export const resolveHyperContext = (context: Context, reference: string): unknown => {
  const [kind, name, ...path] = reference.split('.');
  if (!name || !safe(name) || path.some((key) => !safe(key)))
    throw new Error('Invalid context reference');
  switch (kind) {
    case 'global':
      return readPath(context.engine.getGlobalVariable(name), path);
    case 'result':
      return readPath(context.lastReturnedVal?.[name], path);
    case 'state': {
      const element = context.engine.elements[name];
      if (!element) throw new Error('Context element does not exist');
      return readPath({ ...element.props, ...context.engine.getState(name) }, path);
    }
    case 'method': {
      const [methodName] = path;
      const methods = context.engine.getContextValue(name);
      if (
        !context.engine.elements[name] ||
        path.length !== 1 ||
        !methodName ||
        !methods ||
        !Object.hasOwn(methods, methodName) ||
        typeof methods[methodName] !== 'function'
      )
        throw new Error('Context method does not exist');
      return methods[methodName].bind(methods);
    }
    default:
      throw new Error('Unknown context namespace');
  }
};

/** Project code executes in the page environment, never in Editor, Main or Server. */
export const executeHyperValue = (context: Context, hyperValue: HyperValue): unknown => {
  switch (hyperValue.type) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
      return hyperValue.value;
    case 'contextValue':
      return resolveHyperContext(context, hyperValue.value);
    case 'expression':
      return new Function(`"use strict"; return (${hyperValue.value});`)();
    case 'function': {
      const { params, body } = hyperValue.value;
      const names = params.map((param) => param.name);
      if (
        names.some((name) => !/^[A-Za-z_$][\w$]*$/.test(name) || !safe(name)) ||
        new Set(names).size !== names.length
      )
        throw new Error('Function parameter names must be valid and unique');
      const values = params.map((param) => resolveHyperContext(context, param.value));
      return new Function(...names, `"use strict";\n${body}`)(...values);
    }
  }
};
