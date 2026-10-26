// State/subscription model adapted from Tangramino; see ../../NOTICE.
import { parseLayout } from './layout';
import type { RuntimeEngine, RuntimeSchema, Listener } from './types';
export const ELEMENT_UPDATE = 'element-update';
export const VIEW_UPDATE = 'view-update';

/** Runtime projections are independent of the source document and Editor session. */
export const createEngine = (schema: RuntimeSchema): RuntimeEngine => {
  const listeners = new Map<string, Set<Listener>>();
  const contexts = new Map<string, Record<string, unknown>>();
  const globals = new Map<string, unknown>();
  let controller = new AbortController();
  const notify = () => listeners.get(ELEMENT_UPDATE)?.forEach((listener) => listener());
  const visible = (ids: string[], hidden: boolean) => {
    if (engine.disposed) return;
    engine.elements = { ...engine.elements };
    for (const id of ids)
      if (engine.elements[id]) engine.elements[id] = { ...engine.elements[id]!, hidden };
    notify();
  };
  const engine: RuntimeEngine = {
    elements: structuredClone(schema.elements),
    layouts: parseLayout(schema),
    injectionCallback: {},
    disposed: false,
    get signal() {
      return controller.signal;
    },
    activate: () => {
      engine.disposed = false;
      if (controller.signal.aborted) controller = new AbortController();
    },
    dispose: () => {
      engine.disposed = true;
      controller.abort();
    },
    subscribe: (event, listener) => {
      const group = listeners.get(event) ?? new Set<Listener>();
      listeners.set(event, group);
      group.add(listener);
      return () => {
        group.delete(listener);
      };
    },
    setState: (changes) => {
      if (engine.disposed) return;
      const next = { ...engine.elements };
      for (const [id, props] of Object.entries(changes))
        if (Object.hasOwn(next, id))
          next[id] = { ...next[id]!, props: { ...next[id]!.props, ...props } };
      engine.elements = next;
      notify();
    },
    getState: (id) =>
      id
        ? (engine.elements[id]?.props ?? null)
        : Object.fromEntries(
            Object.entries(engine.elements).map(([key, value]) => [key, value.props]),
          ),
    showElements: (ids) => visible(ids, false),
    hiddenElements: (ids) => visible(ids, true),
    setContextValue: (id, value) => {
      if (!engine.disposed) contexts.set(id, { ...contexts.get(id), ...value });
    },
    getContextValue: (id) => contexts.get(id),
    setGlobalVariable: (name, value) => {
      if (!engine.disposed) globals.set(name, value);
    },
    getGlobalVariable: (name) => globals.get(name),
    injectCallback: (id, name, callback) => {
      const events = (engine.injectionCallback[id] ??= {});
      (events[name] ??= []).push(callback);
    },
  };
  // Keep mutable execution defaults independent of the immutable source document.
  for (const variable of schema.context.globalVariables) {
    let value: unknown = structuredClone(variable.defaultValue);
    if ((variable.type === 'object' || variable.type === 'array') && typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        value = undefined;
      }
    }
    engine.setGlobalVariable(variable.name, value);
  }
  return engine;
};
