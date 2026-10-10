import { Monitor, Redo2, Smartphone, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { EditorHistoryState } from '../../editor';

interface CanvasControlsProps {
  viewportWidth: number;
  onViewportWidthChange: (width: number) => void;
  historyState: EditorHistoryState;
  onUndo: () => void;
  onRedo: () => void;
}

export const CanvasControls = ({
  viewportWidth,
  onViewportWidthChange,
  historyState,
  onUndo,
  onRedo,
}: CanvasControlsProps): React.JSX.Element => (
  <div className='flex min-w-0 flex-1 items-center justify-center gap-2'>
    <div className='flex rounded-lg bg-muted p-0.5' aria-label='画布设备'>
      <Button
        size='sm'
        variant={viewportWidth === 1440 ? 'secondary' : 'ghost'}
        onClick={() => onViewportWidthChange(1440)}
      >
        <Monitor /> PC
      </Button>
      <Button
        size='sm'
        variant={viewportWidth === 375 ? 'secondary' : 'ghost'}
        onClick={() => onViewportWidthChange(375)}
      >
        <Smartphone /> MOBILE
      </Button>
    </div>
    <label className='flex items-center gap-1 text-muted-foreground'>
      画布宽度
      <Input
        type='number'
        min={240}
        value={viewportWidth}
        className='h-7 w-20'
        aria-label='画布宽度'
        onChange={(event) =>
          onViewportWidthChange(Math.max(240, Number(event.target.value) || 240))
        }
      />
      px
    </label>
    <div className='flex overflow-hidden rounded-lg border border-border'>
      <Button
        size='icon-sm'
        variant='ghost'
        className='rounded-none border-r border-border'
        aria-label='撤销'
        disabled={!historyState.canUndo}
        onClick={onUndo}
      >
        <Undo2 />
      </Button>
      <Button
        size='icon-sm'
        variant='ghost'
        className='rounded-none'
        aria-label='重做'
        disabled={!historyState.canRedo}
        onClick={onRedo}
      >
        <Redo2 />
      </Button>
    </div>
  </div>
);
