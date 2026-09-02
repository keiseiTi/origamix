import { Button, Tooltip } from '@heroui/react';
import { useState } from 'react';
import { Eye, SquarePen, MessageSquare } from 'lucide-react';

export type WorkspaceMode = 'chat' | 'edit' | 'preview';

interface WorkspaceHeaderProps {
  projectName: string;
  pageName: string;
  sidebarCollapsed: boolean;
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => Promise<void>;
}

export function WorkspaceHeader({
  projectName,
  pageName,
  sidebarCollapsed,
  mode,
  onModeChange,
}: WorkspaceHeaderProps): React.JSX.Element {
  const [opening, setOpening] = useState(false);
  const openWindow = async (): Promise<void> => {
    setOpening(true);
    try {
      await onModeChange('preview');
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
          <Tooltip.Content placement='bottom'>在预览标签中打开</Tooltip.Content>
        </Tooltip>
      </div>
    </header>
  );
}
