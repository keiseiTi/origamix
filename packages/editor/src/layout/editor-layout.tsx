import { useEffect, useRef, useState } from 'react';
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
  const [error, setError] = useState<string | null>(null);
  const [eventTarget, setEventTarget] = useState<EventTarget | null>(null);
  const view = useRef<HTMLDivElement>(null);
  const restoreEvent = useRef<string | null>(null);
  useEffect(() => {
    if (mode !== 'view' || !restoreEvent.current) return;
    const button = [
      ...(view.current?.querySelectorAll<HTMLButtonElement>('[data-flow-event]') ?? []),
    ].find((item) => item.dataset.flowEvent === restoreEvent.current);
    button?.focus();
    restoreEvent.current = null;
  }, [mode]);
  const editEvent = (target: EventTarget): void => {
    setError(null);
    void onModeChange('logic')
      .then(() => {
        restoreEvent.current = target.event;
        setEventTarget(target);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : '切换失败，编辑内容已保留'),
      );
  };
  return (
    <div className='relative flex min-h-0 flex-1 flex-col'>
      {error && (
        <p role='alert' className='border-b border-border px-3 py-2 text-xs text-danger'>
          {error}
        </p>
      )}
      {mode === 'logic' ? (
        <FlowEditorLoader
          key={eventTarget ? `${eventTarget.elementId}:${eventTarget.event}` : 'empty'}
          target={eventTarget}
          onTargetChange={setEventTarget}
        />
      ) : (
        <div
          ref={view}
          className='relative flex size-full min-h-0 min-w-0 bg-zinc-50 dark:bg-zinc-900'
        >
          <NavigationPanel groups={groups} onEditEvent={editEvent} />
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
          <AttributePanel onEditEvent={editEvent} />
        </div>
      )}
    </div>
  );
};
