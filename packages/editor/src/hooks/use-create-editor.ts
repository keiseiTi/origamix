import { useLayoutEffect, useState } from 'react';
import type { EditorInstance, CreateEditorOptions } from '../interfaces/editor-instance';
import { createEditorInstance, updateEditorOptions } from '../session/editor-instance';
/** One stable instance per retained page; mounting a canvas binds its current draft session. */
export const useCreateEditor = (options: CreateEditorOptions = {}): EditorInstance => {
  const [editor] = useState(() => createEditorInstance(options));

  useLayoutEffect(() => {
    updateEditorOptions(editor, options);
  }, [editor, options]);

  return editor;
};
