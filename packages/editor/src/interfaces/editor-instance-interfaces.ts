import type { OrigamixPageSchema } from '@origamix/shared';
import type { EditorOperations } from './editor-operation-interfaces';
import type { EditorPlugin } from './plugin-interfaces';
import type { EditorMode } from './editor-interfaces';
export type EditorSaveOptions = Readonly<{
  onSave?: () => Promise<void>;
  onFlush?: () => Promise<void>;
  canSave?: boolean;
}>;
export type EditorViewState = Readonly<{
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
export interface EditorInstance extends EditorOperations {
  save: () => Promise<void>;
  undo: () => void;
  redo: () => void;
  setSchema: (schema: OrigamixPageSchema) => void;
  setMode: (mode: EditorMode) => Promise<void>;
  setViewportWidth: (width: number) => void;
}
export type EditorPublicState = Readonly<
  {
    canUndo: boolean;
    canRedo: boolean;
    activeElement: Readonly<{ id: string; type: string }> | null;
    readOnly: boolean;
  } & EditorViewState
>;
