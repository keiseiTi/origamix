import { Button, Tooltip } from '@heroui/react';
import { useState } from 'react';
import { Eye, SquarePen, MessageSquare } from 'lucide-react';

export type WorkspaceMode = 'chat' | 'edit';

interface WorkspaceHeaderProps {
  projectName: string;
  pageName: string;
  projectId: string;
  pageId: string;
  sidebarCollapsed: boolean;
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => Promise<void>;
}

export function WorkspaceHeader({
  projectName,
  pageName,
  projectId,
  pageId,
  sidebarCollapsed,
  mode,
  onModeChange,
}: WorkspaceHeaderProps): React.JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const openWindow = async (): Promise<void> => {
    setOpening(true);
    setError(null);
    try {
      await window.api?.window?.openPage?.({ projectId, pageId, mode: 'preview' });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法打开窗口');
    } finally {
      setOpening(false);
    }
  };
  return (
    <header className='relative flex h-15 min-h-15 items-center justify-between gap-4 border-b border-zinc-200 px-4.5 dark:border-zinc-800'>
      <div className={`min-w-0 font-semibold ${sidebarCollapsed ? 'pl-9' : ''}`}>
        <span className='block truncate' title={`${projectName} - ${pageName}`}>
          {projectName} - {pageName}
        </span>
      </div>
      <div className='flex shrink-0 items-center gap-1'>
        {error && (
          <span role='alert' className='text-xs text-danger'>
            {error}
          </span>
        )}
        <Tooltip>
          <Button
            isIconOnly
            size='sm'
            aria-label={mode === 'edit' ? '返回对话' : '编辑'}
            variant='ghost'
            isDisabled={opening}
            onPress={() => void onModeChange(mode === 'edit' ? 'chat' : 'edit')}
          >
            {mode === 'edit' ? <MessageSquare size={17} /> : <SquarePen size={17} />}
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
            aria-label='预览'
            isDisabled={opening}
            onPress={() => void openWindow()}
          >
            <Eye size={17} />
          </Button>
          <Tooltip.Content placement='bottom'>在新窗口中预览</Tooltip.Content>
        </Tooltip>
      </div>
    </header>
  );
}
