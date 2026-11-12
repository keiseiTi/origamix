import { DragOverlay } from '../canvas/canvas-drag-controls';
import { InsertPositionIndicator } from '../canvas/insert-position-indicator';
import { useEditorCore } from '../../session/editor-context';
import type { Material } from '../../interfaces/material';
import type { EditorMode } from '../../interfaces/editor';
import type { MaterialGroup } from '../../interfaces/material';
import { EditorLayout } from './index';
export const EditorCanvas = ({
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
  const dragElement = useEditorCore((state) => state.dragElement);

  const dragTitle = (dragElement as Material)?.title ?? '';

  return (
    <>
      <EditorLayout
        groups={groups}
        viewportWidth={viewportWidth}
        mode={mode}
        onModeChange={onModeChange}
      />
      <DragOverlay>
        <div className='rounded-md border border-blue-500 bg-white/95 px-3 py-2 text-xs text-blue-700 shadow-lg dark:bg-zinc-900 dark:text-blue-300'>
          {dragTitle}
        </div>
      </DragOverlay>
      <InsertPositionIndicator />
    </>
  );
};
