import { useToastManager } from '@origamix/ui';
import { useState } from 'react';
import type { EditorMode } from '../../interfaces/editor';
import type { EventTarget } from '../flow-editor/flow-graph';
import type { EventFocusTarget } from './event-focus-target';
export const useEventNavigation = (onModeChange: (mode: EditorMode) => Promise<void>) => {
  const notifications = useToastManager();
  const [eventTarget, setEventTarget] = useState<EventTarget | null>(null);
  const [pendingFocus, setPendingFocus] = useState<EventFocusTarget | null>(null);
  const editEvent = (target: EventTarget, source: EventFocusTarget['source']): void => {
    void onModeChange('logic')
      .then(() => {
        setPendingFocus({ elementId: target.elementId, eventName: target.event, source });
        setEventTarget(target);
      })
      .catch((reason: unknown) =>
        notifications.add({
          id: 'editor-view-error',
          type: 'error',
          priority: 'high',
          title: reason instanceof Error ? reason.message : '切换失败，编辑内容已保留',
        }),
      );
  };
  return { eventTarget, setEventTarget, pendingFocus, setPendingFocus, editEvent };
};
