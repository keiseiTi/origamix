import { useToastManager } from '@origamix/ui';
import { useState } from 'react';
import { FlowEditorLoader } from '../flow-editor/flow-editor-loader';
import type { EditorMode } from '../contracts/editor-contracts';
import type { EventTarget } from '../flow-editor/flow-graph';
import { CanvasEditor } from '../canvas/canvas-editor';
import { AttributePanel } from '../panels/attribute-panel';
import { DropIndicator } from '../canvas/drop-indicator';
import { TargetSelectionMarker } from '../canvas/target-selection-marker';
import { SelectionToolbar } from '../canvas/selection-toolbar';
import { NavigationPanel } from '../panels/navigation-panel';
import type { MaterialGroup } from '../panels/material-panel';
import type { EventFocusTarget } from '../panels/event-focus-target';

export const EditorLayout = ({
  groups,
  viewportWidth,
  mode,
  onModeChange,
}: {
  groups: MaterialGroup[];
  viewportWidth: number;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => Promise<void>;
}): React.JSX.Element => {
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
  return (
    <div className='relative flex min-h-0 flex-1 flex-col'>
      {mode === 'logic' ? (
        <FlowEditorLoader
          key={eventTarget ? `${eventTarget.elementId}:${eventTarget.event}` : 'empty'}
          target={eventTarget}
          onTargetChange={setEventTarget}
        />
      ) : (
        <div className='relative flex size-full min-h-0 min-w-0 bg-zinc-50 dark:bg-zinc-900'>
          <NavigationPanel
            groups={groups}
            onEditEvent={(target) => editEvent(target, 'navigation')}
            focusTarget={pendingFocus?.source === 'navigation' ? pendingFocus : null}
            onFocusRestored={() => setPendingFocus(null)}
          />
          <main className='min-w-0 flex-1 overflow-hidden p-3' aria-label='页面画布'>
            <div
              className='mx-auto h-full min-h-full overflow-hidden border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950'
              style={{ width: `min(100%, ${viewportWidth}px)` }}
            >
              <CanvasEditor
                className='relative size-full overflow-auto'
                renderDropIndicator={DropIndicator}
                renderElement={TargetSelectionMarker}
                renderOverlayContent={SelectionToolbar}
              />
            </div>
          </main>
          <AttributePanel
            onEditEvent={(target) => editEvent(target, 'attribute')}
            focusTarget={pendingFocus?.source === 'attribute' ? pendingFocus : null}
            onFocusRestored={() => setPendingFocus(null)}
          />
        </div>
      )}
    </div>
  );
};
