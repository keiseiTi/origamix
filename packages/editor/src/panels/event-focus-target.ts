export interface EventFocusTarget {
  elementId: string;
  eventName: string;
  source: 'navigation' | 'attribute';
}

export interface EventFocusProps {
  focusTarget: EventFocusTarget | null;
  onFocusRestored: () => void;
}
