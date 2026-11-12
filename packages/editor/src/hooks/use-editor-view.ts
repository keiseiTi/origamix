import { useStore } from 'zustand';
import type { EditorInstance, EditorViewState } from '../interfaces/editor-instance';
import { getEditorViewStore } from '../session/editor-instance';
export const useEditorView = <T>(
  editor: EditorInstance,
  selector: (state: EditorViewState) => T,
): T => useStore(getEditorViewStore(editor), selector);
