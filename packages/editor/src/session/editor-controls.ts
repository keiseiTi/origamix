import { useLayoutEffect, useMemo, useState } from 'react';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { useEditorCore, useEditorStoreApi, type EditorCore } from './editor-session';
import type { OrigamixPageSchema } from '@origamix/shared';
import type { EditorMode } from '../contracts/editor-contracts';

type ViewState = Readonly<{ mode: EditorMode; viewportWidth: number }>;
export interface CreateEditorOptions {
  initialMode?: EditorMode;
  initialViewportWidth?: number;
  beforeModeChange?: () => Promise<void>;
}
export interface EditorInstance {
  undo: () => void;
  redo: () => void;
  setSchema: (schema: OrigamixPageSchema) => void;
  setMode: (mode: EditorMode) => Promise<void>;
  setViewportWidth: (width: number) => void;
}
type Binding = { core: StoreApi<EditorCore>; readOnly: boolean };
type InstanceState = {
  view: StoreApi<ViewState>;
  binding: Binding | null;
  options: CreateEditorOptions;
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
      viewportWidth: Math.max(240, options.initialViewportWidth ?? 1440),
    })),
    binding: null,
    options,
  };
  const writable = (): EditorCore => {
    if (!state.binding) throw new Error('Editor session is unavailable');
    if (state.binding.readOnly) throw new Error('当前不可编辑，草稿已保留');
    return state.binding.core.getState();
  };
  const editor: EditorInstance = {
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
): (() => void) => {
  const state = getInstance(editor);
  if (state.binding)
    throw new Error('An Editor instance cannot be shared by multiple mounted editors');
  const binding = { core, readOnly };
  state.binding = binding;
  return () => {
    if (state.binding === binding) state.binding = null;
  };
};
export const useBindEditor = (editor: EditorInstance, readOnly: boolean): void => {
  const core = useEditorStoreApi();
  useLayoutEffect(() => bindEditorSession(editor, core, readOnly), [editor, core, readOnly]);
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
