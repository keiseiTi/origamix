import { createContext, useContext } from 'react';

export interface ClarificationHighlightValue {
  candidates: readonly { elementId: string; label: string }[];
  highlightedElementId: string | null;
  expired: boolean;
  onSelect?: (elementId: string) => void;
}

export const ClarificationHighlightContext = createContext<ClarificationHighlightValue>({
  candidates: [],
  highlightedElementId: null,
  expired: false,
});

export const useClarificationHighlight = (): ClarificationHighlightValue =>
  useContext(ClarificationHighlightContext);
