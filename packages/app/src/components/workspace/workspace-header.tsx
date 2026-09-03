import { Button, Tooltip } from '@heroui/react';
import { useState } from 'react';
import { Eye, SquarePen, MessageSquare } from 'lucide-react';

export type WorkspaceMode = 'chat' | 'edit' | 'preview';

interface WorkspaceHeaderProps {
  projectName: string;
  pageName: string;
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => Promise<void>;
  onPreview: () => Promise<void>;
}

export function WorkspaceHeader({
  projectName,
  pageName,
  mode,
  onModeChange,
  onPreview,
}: WorkspaceHeaderProps): React.JSX.Element {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openWindow = async (): Promise<void> => {
    setOpening(true);
    setError(null);
    try {
      await onPreview();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法打开预览标签');
    } finally {
      setOpening(false);
    }
  };
  return (
    <header className='relative z-10 flex h-9 min-h-9 items-center justify-between gap-3 px-3 text-xs'>
      <div className='min-w-0 font-medium text-zinc-500 dark:text-zinc-400'>
        <span className='block truncate' title={`${projectName} - ${pageName}`}>
          {projectName} / {pageName}
        </span>
      </div>
      <div className='flex shrink-0 items-center gap-1'>
        {error && (
          <span role='alert' className='max-w-56 truncate text-xs text-danger' title={error}>
            {error}
          </span>
        )}
        <Tooltip>
          <Button
            isIconOnly
            size='sm'
            aria-label={mode === 'edit' ? '返回对话' : '编辑'}
            variant='ghost'
            className='h-7 min-h-7 w-7 min-w-7 text-zinc-500 dark:text-zinc-400'
            isDisabled={opening}
            onPress={() => void onModeChange(mode === 'edit' ? 'chat' : 'edit')}
          >
            {mode === 'edit' ? <MessageSquare size={15} /> : <SquarePen size={15} />}
          </Button>
          <Tooltip.Content placement='bottom'>
            {mode === 'edit' ? '返回对话' : '编辑'}
          </Tooltip.Content>
        </Tooltip>
        <Tooltip>
          <Button
            isIconOnly
            size='sm'
            variant='ghost'
            className='h-7 min-h-7 w-7 min-w-7 text-zinc-500 dark:text-zinc-400'
            aria-label='预览'
            isDisabled={opening}
            onPress={() => void openWindow()}
          >
            <Eye size={15} />
          </Button>
          <Tooltip.Content placement='bottom'>在应用标签中打开预览</Tooltip.Content>
        </Tooltip>
      </div>
    </header>
  );
}
