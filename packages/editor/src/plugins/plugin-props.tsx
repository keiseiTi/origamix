import { useSyncExternalStore, type ReactNode } from 'react';
import type { EditorPlugin } from '../interfaces/plugin';

export const pluginPropsBinding = Symbol('editor.pluginProps');
export interface PluginPropsRuntime {
  plugin: EditorPlugin;
  update: (props: unknown) => void;
}
export interface PluginPropsBinding {
  definition: object;
  props: unknown;
  create: () => PluginPropsRuntime;
}
type BoundPlugin = EditorPlugin & { [pluginPropsBinding]?: PluginPropsBinding };
export const getPluginPropsBinding = (plugin: EditorPlugin): PluginPropsBinding | undefined =>
  (plugin as BoundPlugin)[pluginPropsBinding];

/** Each retained Editor owns its own stores, even when definitions are shared. */
export const createPluginPropsRuntime = <Props,>(
  definition: EditorPlugin<Props>,
  initialProps: Props,
): PluginPropsRuntime => {
  let props = initialProps;
  const listeners = new Set<() => void>();
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const getSnapshot = () => props;
  const Render = ({ render }: { render: (props: Props) => ReactNode }) => {
    const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    return render(current);
  };
  const renderers = definition.editor;
  return {
    plugin: {
      ...definition,
      editor: renderers && {
        renderToolbar:
          renderers.renderToolbar &&
          ((context) => (
            <Render render={(props) => renderers.renderToolbar!({ ...context, props })} />
          )),
        renderTop:
          renderers.renderTop &&
          ((context) => <Render render={(props) => renderers.renderTop!({ ...context, props })} />),
        renderBottom:
          renderers.renderBottom &&
          ((context) => (
            <Render render={(props) => renderers.renderBottom!({ ...context, props })} />
          )),
      },
    },
    update: (next) => {
      if (Object.is(props, next)) return;
      props = next as Props;
      for (const listener of listeners) listener();
    },
  };
};
