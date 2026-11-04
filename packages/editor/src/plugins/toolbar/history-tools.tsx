import { Redo2, Undo2 } from 'lucide-react';
import { Button } from '@origamix/ui';
import { useEditorContext, useEditorSelector } from '../../session/editor-controls';

export const HistoryTools = () => {
  const editor = useEditorContext();
  const canUndo = useEditorSelector((state) => state.canUndo && !state.readOnly);
  const canRedo = useEditorSelector((state) => state.canRedo && !state.readOnly);
  const mode = useEditorSelector((state) => state.mode);
  if (mode !== 'view') return null;
  return (
    <div className='flex overflow-hidden rounded-lg border border-border'>
      <Button
        size='icon-sm'
        variant='ghost'
        className='rounded-none border-r border-border'
        aria-label='撤销'
        disabled={!canUndo}
        onClick={editor.undo}
      >
        <Undo2 />
      </Button>
      <Button
        size='icon-sm'
        variant='ghost'
        className='rounded-none'
        aria-label='重做'
        disabled={!canRedo}
        onClick={editor.redo}
      >
        <Redo2 />
      </Button>
    </div>
  );
};

/** Toolbar contribution only; history storage and shortcuts remain owned by the existing session. */
