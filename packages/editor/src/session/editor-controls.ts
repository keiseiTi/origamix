import { useLayoutEffect, useMemo, useState, useRef } from 'react';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { useEditorCore, useEditorStoreApi, type EditorCore } from './editor-session';
import type { OrigamixPageSchema } from '@origamix/shared';
import type { EditorPlugin } from '../contracts/plugin-contracts';
import { snapshotEditorPlugins, startEditorPlugins } from '../plugins/plugin-host';
import type { EditorMode } from '../contracts/editor-contracts';

export type EditorSaveOptions = Readonly<{
  onSave?: () => Promise<void>;
  onFlush?: () => Promise<void>;
  canSave?: boolean;
}>;
type ViewState = Readonly<{
  mode: EditorMode;
  viewportWidth: number;
  saving: boolean;
  canSave: boolean;
  saveError: string | null;
}>;
export interface CreateEditorOptions {
  plugins?: readonly EditorPlugin[];
  initialMode?: EditorMode;
  initialViewportWidth?: number;
  beforeModeChange?: () => Promise<void>;
}
export interface EditorInstance {
  save: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  setSchema: (schema: OrigamixPageSchema) => void;
  setMode: (mode: EditorMode) => Promise<void>;
  setViewportWidth: (width: number) => void;
}
type Binding = { core: StoreApi<EditorCore>; readOnly: boolean; save: EditorSaveOptions };
type InstanceState = {
  view: StoreApi<ViewState>;
  binding: Binding | null;
  options: CreateEditorOptions;
  plugins: readonly EditorPlugin[];
};
const instances = new WeakMap<EditorInstance, InstanceState>();
const getInstance = (editor: EditorInstance): InstanceState => {
  const state = instances.get(editor);
  if (!state) throw new Error('Invalid Editor instance');
  return state;
};
export const createEditorInstance = (options: CreateEditorOptions = {}): EditorInstance => {
  const state: InstanceState = {
    view: createStore<ViewState>(() => ({
      mode: options.initialMode ?? 'view',
      saving: false,
      canSave: false,
      saveError: null,
      viewportWidth: Math.max(240, options.initialViewportWidth ?? 1440),
    })),
    plugins: snapshotEditorPlugins(options.plugins ?? []),
    binding: null,
    options,
  };
  const writable = (): EditorCore => {
    if (!state.binding) throw new Error('Editor session is unavailable');
    if (state.binding.readOnly) throw new Error('当前不可编辑，草稿已保留');
    return state.binding.core.getState();
  };
  const editor: EditorInstance = {
    save: async () => {
      const binding = state.binding;
      if (!binding) throw new Error('Editor session is unavailable');
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
    setSchema: (schema) => writable().setSchema(schema),
    setViewportWidth: (width) => {
      if (Number.isFinite(width)) state.view.setState({ viewportWidth: Math.max(240, width) });
    },
    setMode: async (mode) => {
      const binding = state.binding;
      if (!binding) throw new Error('Editor session is unavailable');
      await state.options.beforeModeChange?.();
      // A flush may outlive the canvas/page that requested the switch.
      if (state.binding !== binding) throw new Error('编辑会话已切换，请重试');
      state.view.setState({ mode });
    },
  };
  instances.set(editor, state);
  return editor;
};
/** One stable instance per retained page; mounting a canvas binds its current draft session. */
export const useCreateEditor = (options: CreateEditorOptions = {}): EditorInstance => {
  const [editor] = useState(() => createEditorInstance(options));
  useLayoutEffect(() => {
    getInstance(editor).options = options;
  }, [editor, options]);
  return editor;
};
export const useEditorContext = (): EditorInstance => {
  const editor = useEditorCore((state) => state.editor);
  if (!editor) throw new Error('Editor context is unavailable');
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
  const binding = { core, readOnly, save };
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
  const scoped: EditorInstance = {
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
      editor.setSchema(schema);
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
  let dispose: () => void;
  try {
    dispose = startEditorPlugins(state.plugins, scoped, () => {
      active = false;
    });
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
export const useBindEditor = (
  editor: EditorInstance,
  readOnly: boolean,
  save: EditorSaveOptions,
): void => {
  const core = useEditorStoreApi();
  const initialSave = useRef(save);
  useLayoutEffect(() => {
    initialSave.current = save;
  }, [save]);
  useLayoutEffect(
    () => bindEditorSession(editor, core, core.getState().readOnly, initialSave.current),
    [editor, core],
  );
  useLayoutEffect(() => {
    const binding = getInstance(editor).binding;
    if (binding?.core === core) {
      binding.readOnly = readOnly;
      binding.save = save;
      getInstance(editor).view.setState({
        canSave: Boolean(save.onSave) && save.canSave !== false,
      });
    }
  }, [editor, core, readOnly, save]);
};
export const useEditorView = <T>(editor: EditorInstance, selector: (state: ViewState) => T): T =>
  useStore(getInstance(editor).view, selector);
export type EditorPublicState = Readonly<
  Pick<EditorCore, 'canUndo' | 'canRedo'> & {
    activeElement: Readonly<{ id: string; type: string }> | null;
    readOnly: boolean;
  } & ViewState
>;
const createPublicSource = (
  editor: EditorInstance,
  core: StoreApi<EditorCore>,
): Pick<StoreApi<EditorPublicState>, 'getState' | 'getInitialState' | 'subscribe'> => {
  const view = getInstance(editor).view;
  let previousCore: EditorCore | undefined;
  let previousView: ViewState | undefined;
  let snapshot: EditorPublicState;
  const getState = (): EditorPublicState => {
    const currentCore = core.getState();
    const currentView = view.getState();
    if (previousCore !== currentCore || previousView !== currentView) {
      const active = currentCore.activeElement;
      const activeElement =
        previousCore?.activeElement === active
          ? snapshot.activeElement
          : active
            ? { id: active.id, type: active.type }
            : null;
      previousCore = currentCore;
      previousView = currentView;
      snapshot = {
        canUndo: currentCore.canUndo,
        canRedo: currentCore.canRedo,
        activeElement,
        readOnly: currentCore.readOnly,
        ...currentView,
      };
    }
    return snapshot;
  };
  return {
    getState,
    getInitialState: getState,
    subscribe: (listener) => {
      let previous = getState();
      const notify = () => {
        const current = getState();
        const old = previous;
        previous = current;
        listener(current, old);
      };
      const unsubscribeCore = core.subscribe(notify);
      const unsubscribeView = view.subscribe(notify);
      return () => {
        unsubscribeCore();
        unsubscribeView();
      };
    },
  };
};
export const useEditorSelector = <T>(selector: (state: EditorPublicState) => T): T => {
  const editor = useEditorContext();
  const core = useEditorStoreApi();
  const source = useMemo(() => createPublicSource(editor, core), [editor, core]);
  return useStore(source, selector);
};

/** Internal immutable plugin definitions for rendering; never exposes the engine. */
export const getEditorPlugins = (editor: EditorInstance): readonly EditorPlugin[] =>
  getInstance(editor).plugins;
