import { createContext, useContext } from 'react';
import type { EditorTargetSelection } from '../contracts/editor-contracts';

export const TargetSelectionContext = createContext<EditorTargetSelection | undefined>(undefined);
export const useTargetSelection = (): EditorTargetSelection | undefined =>
  useContext(TargetSelectionContext);
