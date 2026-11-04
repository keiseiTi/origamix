import { useLayoutEffect, useRef } from 'react';
import type { EditorInstance, EditorSaveOptions } from '../interfaces/editor-instance-interfaces';
import { useEditorStoreApi } from './editor-context';
import { bindEditorSession, updateEditorBinding } from './editor-instance';
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
    updateEditorBinding(editor, core, readOnly, save);
  }, [editor, core, readOnly, save]);
};
