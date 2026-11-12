import { createSchemaTransform } from '../plugins/schema-plugins';
import { getPluginPropsBinding, type PluginPropsRuntime } from '../plugins/plugin-props';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { EditorCore } from './editor-store';
import type {
  EditorInstance,
  EditorSaveOptions,
  CreateEditorOptions,
  EditorViewState,
} from '../interfaces/editor-instance';
import type { EditorPlugin } from '../interfaces/plugin';
import { createEditorOperations } from './editor-operations';
import { snapshotEditorPlugins, startEditorPlugins } from '../plugins/plugin-host';
type Binding = {
  core: StoreApi<EditorCore>;
  readOnly: boolean;
  save: EditorSaveOptions;
  subscriptions: Set<() => void>;
  ready: boolean;
};
type InstanceState = {
  view: StoreApi<EditorViewState>;
  binding: Binding | null;
  options: CreateEditorOptions;
  plugins: readonly EditorPlugin[];
  pluginProps: readonly (Readonly<{ definition: object; runtime: PluginPropsRuntime }> | null)[];
};
const instances = new WeakMap<EditorInstance, InstanceState>();
const getInstance = (editor: EditorInstance): InstanceState => {
  const state = instances.get(editor);
  if (!state) throw new Error('Invalid Editor instance');
  return state;
};
export const createEditorInstance = (options: CreateEditorOptions = {}): EditorInstance => {
  const pluginProps = (options.plugins ?? []).map((plugin) => {
    const binding = getPluginPropsBinding(plugin);
    return binding ? { definition: binding.definition, runtime: binding.create() } : null;
  });
  const state: InstanceState = {
    view: createStore<EditorViewState>(() => ({
      mode: options.initialMode ?? 'view',
      saving: false,
      canSave: false,
      saveError: null,
      viewportWidth: Math.max(240, options.initialViewportWidth ?? 1440),
    })),
    plugins: snapshotEditorPlugins(
      (options.plugins ?? []).map((plugin, index) => pluginProps[index]?.runtime.plugin ?? plugin),
    ),
    pluginProps,
    binding: null,
    options,
  };
  const readable = (): EditorCore => {
    if (!state.binding) throw new Error('Editor session is unavailable');
    return state.binding.core.getState();
  };
  const writable = (): EditorCore => {
    if (!state.binding) throw new Error('Editor session is unavailable');
    if (!state.binding.ready) throw new Error('插件初始化期间不能修改页面，请在初始化完成后操作');
    if (state.binding.readOnly) throw new Error('当前不可编辑，草稿已保留');
    const core = state.binding.core.getState();
    core.assertCanMutate();
    return core;
  };
  const editor: EditorInstance = {
    ...createEditorOperations(readable, writable),
    on: (event, listener) => {
      const core = readable();
      const binding = state.binding!;
      const off = core.on(event, listener);
      const unsubscribe = (): void => {
        off();
        binding.subscriptions.delete(unsubscribe);
      };
      binding.subscriptions.add(unsubscribe);
      return unsubscribe;
    },
    save: async () => {
      const binding = state.binding;
      if (!binding) throw new Error('Editor session is unavailable');
      if (!binding.ready) throw new Error('插件初始化期间不能保存页面');
      if (state.view.getState().saving) throw new Error('正在保存，请稍候');
      if (!binding.save.onSave || binding.save.canSave === false) throw new Error('当前不可保存');
      const onSave = binding.save.onSave;
      state.view.setState({ saving: true, saveError: null });
      try {
        await binding.save.onFlush?.();
        if (state.binding !== binding) throw new Error('编辑会话已切换，请重试');
        if (!state.view.getState().canSave) throw new Error('当前不可保存');
        await onSave();
        if (state.binding !== binding) throw new Error('编辑会话已切换，请重试');
      } catch (error) {
        if (state.binding === binding)
          state.view.setState({
            saveError: error instanceof Error ? error.message : '保存失败，草稿已保留',
          });
        throw error;
      } finally {
        if (state.binding === binding) state.view.setState({ saving: false });
      }
    },
    undo: () => writable().undo(),
    redo: () => writable().redo(),
    setSchema: (schema) => writable().setSchema(schema, { source: 'external' }),
    setViewportWidth: (width) => {
      if (Number.isFinite(width)) state.view.setState({ viewportWidth: Math.max(240, width) });
    },
    setMode: async (mode) => {
      const binding = state.binding;
      if (!binding) throw new Error('Editor session is unavailable');
      if (!binding.ready) throw new Error('插件初始化期间不能切换模式');
      await state.options.beforeModeChange?.();
      // A flush may outlive the canvas/page that requested the switch.
      if (state.binding !== binding) throw new Error('编辑会话已切换，请重试');
      state.view.setState({ mode });
    },
  };
  instances.set(editor, state);
  return editor;
};
/** Internal lifecycle binding. The raw mutable engine is never part of the public instance. */
export const bindEditorSession = (
  editor: EditorInstance,
  core: StoreApi<EditorCore>,
  readOnly: boolean,
  save: EditorSaveOptions = {},
): (() => void) => {
  const state = getInstance(editor);
  if (state.binding)
    throw new Error('An Editor instance cannot be shared by multiple mounted editors');
  const binding: Binding = { core, readOnly, save, subscriptions: new Set(), ready: false };
  state.view.setState({
    saving: false,
    saveError: null,
    canSave: Boolean(save.onSave) && save.canSave !== false,
  });
  state.binding = binding;
  let active = true;
  const assertActive = (): void => {
    if (!active || state.binding !== binding)
      throw new Error('Editor plugin session is unavailable');
  };
  // Plugins retain a scoped facade, never the instance that can bind a later page.
  const readScoped = (): EditorCore => {
    assertActive();
    return core.getState();
  };
  const writeScoped = (): EditorCore => {
    const current = readScoped();
    if (!binding.ready) throw new Error('插件初始化期间不能修改页面，请在初始化完成后操作');
    if (binding.readOnly) throw new Error('当前不可编辑，草稿已保留');
    current.assertCanMutate();
    return current;
  };
  const scoped: EditorInstance = {
    ...createEditorOperations(readScoped, writeScoped),
    on: (event, listener) => {
      assertActive();
      return editor.on(event, listener);
    },
    save: async () => {
      assertActive();
      await editor.save();
    },
    undo: () => {
      assertActive();
      editor.undo();
    },
    redo: () => {
      assertActive();
      editor.redo();
    },
    setSchema: (schema) => {
      assertActive();
      writeScoped().setSchema(schema, { source: 'plugin' });
    },
    setViewportWidth: (width) => {
      assertActive();
      editor.setViewportWidth(width);
    },
    setMode: async (mode) => {
      assertActive();
      await editor.setMode(mode);
    },
  };
  const plugins = core.getState().plugins ?? state.plugins;
  const transformSchema = createSchemaTransform(plugins);
  let dispose: () => void;
  try {
    dispose = startEditorPlugins(plugins, scoped, () => {
      if (core.getState().transformSchema === transformSchema)
        core.setState({ transformSchema: undefined });
      active = false;
      binding.ready = false;
      for (const off of [...binding.subscriptions]) off();
    });
    core.setState({ transformSchema });
    binding.ready = true;
  } catch (error) {
    active = false;
    state.binding = null;
    throw error;
  }
  return () => {
    active = false;
    if (state.binding === binding) {
      state.binding = null;
      state.view.setState({ saving: false, canSave: false, saveError: null });
    }
    dispose();
  };
};
/** Internal immutable plugin definitions for rendering; never exposes the engine. */
export const getEditorPlugins = (editor: EditorInstance): readonly EditorPlugin[] =>
  getInstance(editor).plugins;

export const updateEditorOptions = (editor: EditorInstance, options: CreateEditorOptions): void => {
  const state = getInstance(editor);
  const updates = state.pluginProps.map((entry, index) => {
    if (!entry) return null;
    const binding = options.plugins?.[index] && getPluginPropsBinding(options.plugins[index]);
    if (!binding || binding.definition !== entry.definition)
      throw new Error('Changing Editor plugin definitions requires a new Editor instance');
    return { runtime: entry.runtime, props: binding.props };
  });
  state.options = options;
  for (const update of updates) update?.runtime.update(update.props);
};
export const updateEditorBinding = (
  editor: EditorInstance,
  core: StoreApi<EditorCore>,
  readOnly: boolean,
  save: EditorSaveOptions,
): void => {
  const state = getInstance(editor);
  const binding = state.binding;
  if (binding?.core === core) {
    binding.readOnly = readOnly;
    binding.save = save;
    state.view.setState({ canSave: Boolean(save.onSave) && save.canSave !== false });
  }
};
export const getEditorViewStore = (editor: EditorInstance): StoreApi<EditorViewState> =>
  getInstance(editor).view;
