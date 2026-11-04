import type { EditorPlugin, EditorPluginDefinition } from '../interfaces/plugin-interfaces';
import { createPluginPropsRuntime, pluginPropsBinding } from './plugin-props';

export const defineEditorPlugin = <Props = undefined>(
  plugin: EditorPlugin<Props>,
): EditorPluginDefinition<Props> => ({
  ...plugin,
  withProps: (props) => ({
    id: plugin.id,
    [pluginPropsBinding]: {
      definition: plugin,
      props,
      create: () => createPluginPropsRuntime(plugin, props),
    },
  }),
});
