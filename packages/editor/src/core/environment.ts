import { createContext, useContext } from 'react';
import type { MaterialManifest } from '@origamix/shared';
import type { EditorTheme } from '../contracts';

export const EditorThemeContext = createContext<EditorTheme>('light');
export const MaterialCatalogContext = createContext<readonly MaterialManifest[]>([]);
export const useMaterialCatalog = (): readonly MaterialManifest[] =>
  useContext(MaterialCatalogContext);
