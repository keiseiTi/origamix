import { Monitor, Smartphone } from 'lucide-react';
import { Button, Input } from '@origamix/ui';
import { useEditorContext } from '../../hooks/use-editor-context';
import { useEditorSelector } from '../../hooks/use-editor-selector';

export const ViewportTools = () => {
  const editor = useEditorContext();
  const width = useEditorSelector((state) => state.viewportWidth);
  const mode = useEditorSelector((state) => state.mode);
  if (mode !== 'view') return null;
  return (
    <>
      <div className='flex rounded-lg bg-muted p-0.5' aria-label='画布设备'>
        <Button
          size='sm'
          variant={width === 1440 ? 'secondary' : 'ghost'}
          onClick={() => editor.setViewportWidth(1440)}
        >
          <Monitor /> PC
        </Button>
        <Button
          size='sm'
          variant={width === 375 ? 'secondary' : 'ghost'}
          onClick={() => editor.setViewportWidth(375)}
        >
          <Smartphone /> MOBILE
        </Button>
      </div>
      <label className='flex items-center gap-1 text-muted-foreground'>
        画布宽度
        <Input
          type='number'
          min={240}
          value={width}
          className='h-7 w-20'
          aria-label='画布宽度'
          onChange={(event) =>
            editor.setViewportWidth(Math.max(240, Number(event.target.value) || 240))
          }
        />
        px
      </label>
    </>
  );
};
