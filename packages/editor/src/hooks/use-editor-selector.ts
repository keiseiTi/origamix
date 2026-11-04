import { useMemo } from 'react';
import { useStore } from 'zustand';
import type { EditorPublicState } from '../interfaces/editor-instance-interfaces';
import { useEditorContext } from './use-editor-context';
import { useEditorStoreApi } from '../session/editor-context';
import { createPublicSource } from '../session/editor-public-state';
export const useEditorSelector = <T>(selector: (state: EditorPublicState) => T): T => {
  const editor = useEditorContext();
  const core = useEditorStoreApi();
  const source = useMemo(() => createPublicSource(editor, core), [editor, core]);
  return useStore(source, selector);
};
