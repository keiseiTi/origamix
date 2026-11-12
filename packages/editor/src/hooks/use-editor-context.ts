import type { EditorInstance } from '../interfaces/editor-instance';
import { useEditorCore } from '../session/editor-context';

export const useEditorContext = (): EditorInstance => {
  const editor = useEditorCore((state) => state.editor);
  if (!editor) throw new Error('Editor context is unavailable');
  return editor;
};
