import { createContext, useContext } from 'react';
import type { EditorTargetSelection } from './interface';

export const TargetSelectionContext = createContext<EditorTargetSelection | undefined>(undefined);
export const useTargetSelection = (): EditorTargetSelection | undefined =>
  useContext(TargetSelectionContext);
