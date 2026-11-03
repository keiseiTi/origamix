import { createContext, useContext, useMemo } from 'react';
import { useEditorCore, useEditorStoreApi } from './editor-session';
import type { EditorCore } from './editor-session';
import type { EditorMode, EditorTool } from '../contracts/editor-contracts';

type Controls = {
  mode: EditorMode;
  readOnly: boolean;
  viewportWidth: number;
  onModeChange: (mode: EditorMode) => Promise<void>;
  onViewportWidthChange: (width: number) => void;
  onOpenTool: (tool: Exclude<EditorTool, 'history'> | null) => void;
};
export const EditorControlsContext = createContext<Controls | null>(null);
const useControls = (): Controls => {
  const controls = useContext(EditorControlsContext);
  if (!controls) throw new Error('Editor controls are unavailable');
  return controls;
};
export type EditorPublicState = Readonly<
  Pick<EditorCore, 'canUndo' | 'canRedo'> & {
    activeElement: Readonly<{ id: string; type: string }> | null;
  } & Pick<Controls, 'mode' | 'readOnly' | 'viewportWidth'>
>;
export const useEditorStore = <T>(selector: (state: EditorPublicState) => T): T => {
  const controls = useControls();
  const active = useEditorCore((state) => state.activeElement);
  const activeElement = useMemo(
    () => (active ? { id: active.id, type: active.type } : null),
    [active],
  );
  return useEditorCore((state) =>
    selector({
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      activeElement,
      mode: controls.mode,
      readOnly: controls.readOnly,
      viewportWidth: controls.viewportWidth,
    }),
  );
};
export const useEditorCommands = () => {
  const store = useEditorStoreApi();
  const controls = useControls();
  return useMemo(
    () => ({
      undo: () => {
        if (!controls.readOnly) store.getState().undo();
      },
      redo: () => {
        if (!controls.readOnly) store.getState().redo();
      },
      setMode: controls.onModeChange,
      setViewportWidth: controls.onViewportWidthChange,
      openTool: (tool: Exclude<EditorTool, 'history'> | null) => {
        if (!controls.readOnly) controls.onOpenTool(tool);
      },
    }),
    [store, controls],
  );
};
