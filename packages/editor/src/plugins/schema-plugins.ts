import type { OrigamixPageSchema } from '@origamix/shared';
import type {
  EditorChangeSource,
  EditorEvents,
  EditorReadonly,
} from '../interfaces/editor-operation-interfaces';
import type {
  EditorPlugin,
  EditorPluginSchemaContext,
  EditorSchemaEventName,
} from '../interfaces/plugin-interfaces';
import { editorSnapshot } from '../session/editor-snapshots';

export const subscribeSchemaPlugin = (
  plugin: EditorPlugin,
  context: EditorPluginSchemaContext,
): (() => void) => {
  const cleanups: (() => void)[] = [];
  const subscribe = <K extends EditorSchemaEventName>(
    event: K,
    handler: ((payload: EditorEvents[K], context: EditorPluginSchemaContext) => void) | undefined,
  ): void => {
    if (handler) cleanups.push(context.editor.on(event, (payload) => handler(payload, context)));
  };
  subscribe('elementInsert', plugin.schema?.elementInsert);
  subscribe('elementRemove', plugin.schema?.elementRemove);
  subscribe('elementMove', plugin.schema?.elementMove);
  subscribe('elementPropsChange', plugin.schema?.elementPropsChange);
  subscribe('change', plugin.schema?.change);
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
};

/** One right-to-left pass; no observer callbacks or persistence run here. */
export const createSchemaTransform = (plugins: readonly EditorPlugin[]) => {
  const hooks = [...plugins]
    .reverse()
    .flatMap((plugin) => (plugin.schema?.beforeChange ? [plugin.schema.beforeChange] : []));
  return (
    before: OrigamixPageSchema,
    candidate: EditorReadonly<OrigamixPageSchema>,
    source: EditorChangeSource,
  ): EditorReadonly<OrigamixPageSchema> => {
    let next: EditorReadonly<OrigamixPageSchema> = candidate;
    for (const hook of hooks) {
      const result = hook({
        before: editorSnapshot(before),
        candidate: editorSnapshot(next),
        source,
      });
      if (result instanceof Promise) {
        void result.catch(() => undefined);
        throw new Error('schema.beforeChange 必须同步返回候选 Schema');
      }
      if (result !== undefined) next = structuredClone(result);
    }
    return next;
  };
};
