import { useEventNavigation } from './use-event-navigation';
import { FlowEditorLoader } from '../flow-editor/flow-editor-loader';
import type { EditorMode } from '../../interfaces/editor';
import { CanvasEditor } from '../canvas';
import { AttributePanel } from '../attribute-panel';
import { DropIndicator } from '../canvas/drop-indicator';
import { TargetSelectionMarker } from '../canvas/target-selection-marker';
import { SelectionToolbar } from '../canvas/selection-toolbar';
import { NavigationPanel } from '../navigation-panel';
import type { MaterialGroup } from '../../interfaces/material';

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
  const { eventTarget, setEventTarget, pendingFocus, setPendingFocus, editEvent } =
    useEventNavigation(onModeChange);
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
