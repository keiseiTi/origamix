import { CanvasEditor } from '@tangramino/base-editor';
import { AttributePanel } from './attribute-panel';
import { DropIndicator, EditableElement, EditorOverlay } from './canvas-tools';
import { LeftPanel } from './left-panel';
import type { MaterialGroup } from './material-panel';

export const MainContent = ({
  groups,
  viewportWidth,
}: {
  groups: MaterialGroup[];
  viewportWidth: number;
}): React.JSX.Element => (
  <div className='relative flex size-full min-w-0 bg-zinc-50 dark:bg-zinc-900'>
    <LeftPanel groups={groups} />
    <main className='min-w-0 flex-1 overflow-hidden p-3' aria-label='页面画布'>
      <div
        className='mx-auto h-full min-h-full overflow-hidden border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950'
        style={{ width: viewportWidth < 1440 && viewportWidth > 568 ? 'auto' : viewportWidth }}
      >
        <CanvasEditor
          className='relative size-full overflow-auto'
          renderDropIndicator={DropIndicator}
          renderElement={EditableElement}
          renderOverlayContent={EditorOverlay}
        />
      </div>
    </main>
    <AttributePanel />
  </div>
);
