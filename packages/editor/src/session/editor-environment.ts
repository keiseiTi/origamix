import { useContext } from 'react';
import { useStore } from 'zustand';
import { EditorSessionContext, useEditorCore } from './editor-context';
import type { EditorTheme } from '../interfaces/editor-interfaces';

// Standalone CodeEditor also works outside an editor session.
const defaultEnvironment = { theme: 'light' as EditorTheme };
const standaloneEnvironment = {
  getState: () => defaultEnvironment,
  getInitialState: () => defaultEnvironment,
  subscribe: () => () => undefined,
};
export const useEditorTheme = (): EditorTheme => {
  const store = useContext(EditorSessionContext);
  return useStore(store ?? standaloneEnvironment, (state) => state.theme);
};
export const useMaterialCatalog = () => useEditorCore((state) => state.materialCatalog);
