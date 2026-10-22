import type { MaterialManifest } from '@origamix/shared';
import type { createEngine, FlowExecuteContext } from '@tangramino/engine';

type Engine = ReturnType<typeof createEngine>;
type Context = FlowExecuteContext<Record<string, unknown>>;
export interface RuntimeMaterialMetadata {
  context: MaterialManifest['context'];
  defaultProps: Readonly<Record<string, unknown>>;
  initialState: (props: Record<string, unknown>) => Record<string, unknown>;
  eventPayload: (event: string, args: unknown[], props: Record<string, unknown>) => unknown;
}
const metadata = new WeakMap<Engine, Readonly<Record<string, RuntimeMaterialMetadata>>>();
const liveValues = new WeakMap<Engine, Record<string, Record<string, unknown>>>();
export const writeRuntimeState = (
  engine: Engine,
  id: string,
  patch: Record<string, unknown>,
): void => {
  const values = liveValues.get(engine);
  if (values) values[id] = { ...values[id], ...patch };
};
export const readRuntimeState = (engine: Engine, id: string): Record<string, unknown> => ({
  ...engine.getState(id),
  ...liveValues.get(engine)?.[id],
});
const activeEvent = new WeakMap<Engine, unknown>();
const eventRuns = new WeakMap<object, unknown>();
export const captureRuntimeEvent = (context: Context): void => {
  if (context.lastReturnedVal)
    eventRuns.set(context.lastReturnedVal, activeEvent.get(context.engine));
};
export const runtimeEvent = (context: Context): unknown =>
  eventRuns.get(context.lastReturnedVal ?? {});
export const runtimeCapability = (
  engine: Engine,
  id: string,
): RuntimeMaterialMetadata | undefined => metadata.get(engine)?.[engine.elements[id]?.type ?? ''];
export const assertRuntimeMethod = (engine: Engine, id: string, name: string): void => {
  if (
    metadata.has(engine) &&
    !runtimeCapability(engine, id)?.context.values.some(
      (entry) => entry.isMethod && entry.name === name,
    )
  )
    throw new Error('Context method is not callable');
};
export const assertRuntimeField = (
  engine: Engine,
  id: string,
  path: string,
  write = false,
): void => {
  const capability = runtimeCapability(engine, id);
  // Standalone node evaluators can be embedded without a rendering catalog. Product renderers always install one.
  if (!metadata.has(engine)) return;
  const fields = write ? capability?.context.writable : capability?.context.variables;
  if (
    !(fields ?? []).some(
      (field) => path === field.name || (!write && path.startsWith(`${field.name}.`)),
    )
  )
    throw new Error(`Element property is not ${write ? 'writable' : 'readable'}: ${path}`);
};

/** Runtime-only bridge; none of these updates reach the source Schema/Working store. */
export const installMaterialState = (engine: Engine, components: Record<string, unknown>): void => {
  const entries: Record<string, RuntimeMaterialMetadata> = {};
  for (const [type, component] of Object.entries(components)) {
    const value = (component as { origamixRuntime?: RuntimeMaterialMetadata }).origamixRuntime;
    if (value) entries[type] = value;
  }
  metadata.set(engine, entries);
  liveValues.set(engine, {});
  for (const [id, element] of Object.entries(engine.elements)) {
    const capability = entries[element.type];
    const props = { ...capability?.defaultProps, ...element.props };
    const initial = { ...props, ...capability?.initialState(props) };
    writeRuntimeState(engine, id, initial);
    engine.setState({
      [id]: {
        ...initial,
        tg_mode: 'render',
        tg_setRuntimeState: (patch: Record<string, unknown>) => {
          const previous = readRuntimeState(engine, id);
          const changes = Object.fromEntries(
            Object.entries(patch).filter(
              ([key, value]) =>
                !key.startsWith('tg_') &&
                !['__proto__', 'prototype', 'constructor'].includes(key) &&
                JSON.stringify(previous?.[key]) !== JSON.stringify(value),
            ),
          );
          if (Object.keys(changes).length) writeRuntimeState(engine, id, changes);
        },
        tg_setContextValues: (values: Record<string, unknown>) =>
          engine.setContextValue(id, { ...engine.getContextValue(id), ...values }),
      },
    });
  }
};

/** Snapshot the event into this invocation at its start node, before any asynchronous actions. */
export const bindMaterialEventPayloads = (engine: Engine): void => {
  engine.injectionCallback = Object.fromEntries(
    Object.entries(engine.injectionCallback).map(([id, callbacks]) => [
      id,
      Object.fromEntries(
        Object.entries(callbacks).map(([event, handlers]) => [
          event,
          handlers.map((handler) => (...args: unknown[]) => {
            activeEvent.set(
              engine,
              structuredClone(
                runtimeCapability(engine, id)?.eventPayload(
                  event,
                  args,
                  readRuntimeState(engine, id),
                ) ?? null,
              ),
            );
            return handler(...args);
          }),
        ]),
      ),
    ]),
  );
};
