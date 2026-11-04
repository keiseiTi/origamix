import { getPluginPropsBinding } from './plugin-props';
import type { EditorPlugin } from '../interfaces/plugin-interfaces';
import type { EditorInstance } from '../interfaces/editor-instance-interfaces';

/** Capture one session's definitions; later renders cannot replace its plugin set. */
export const snapshotEditorPlugins = (
  plugins: readonly EditorPlugin[],
): readonly EditorPlugin[] => {
  const ids = new Set<string>();
  return Object.freeze(
    plugins.map((plugin) => {
      if (getPluginPropsBinding(plugin))
        throw new Error('withProps bindings must be installed through useCreateEditor');
      if (!plugin.id.trim() || ids.has(plugin.id))
        throw new Error(`Invalid or duplicate Editor plugin ID: ${plugin.id}`);
      ids.add(plugin.id);
      return Object.freeze({
        ...plugin,
        material: plugin.material && Object.freeze({ ...plugin.material }),
        editor: plugin.editor && Object.freeze({ ...plugin.editor }),
      });
    }),
  );
};

export const startEditorPlugins = (
  plugins: readonly EditorPlugin[],
  editor: EditorInstance,
  invalidate: () => void,
): (() => void) => {
  const cleanups: (() => void)[] = [];
  const controller = new AbortController();
  const dispose = (): void => {
    invalidate();
    controller.abort();
    const errors: unknown[] = [];
    for (const cleanup of cleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Editor plugin cleanup failed');
  };
  for (const plugin of [...plugins].reverse()) {
    try {
      const cleanup = plugin.setup?.({ editor, signal: controller.signal });
      if (cleanup) cleanups.push(cleanup);
    } catch (error) {
      try {
        dispose();
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          `Editor plugin setup failed: ${plugin.id}`,
          { cause: cleanupError },
        );
      }
      throw new Error(`Editor plugin setup failed: ${plugin.id}`, { cause: error });
    }
  }
  return dispose;
};
