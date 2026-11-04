import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import type { EditorCore } from './editor-store';
export const EditorSessionContext = createContext<StoreApi<EditorCore> | null>(null);
export const useEditorStoreApi = (): StoreApi<EditorCore> => {
  const store = useContext(EditorSessionContext);
  if (!store) throw new Error('Editor session is unavailable');
  return store;
};
export const useEditorCore = <T>(selector: (state: EditorCore) => T): T =>
  useStore(useEditorStoreApi(), selector);
