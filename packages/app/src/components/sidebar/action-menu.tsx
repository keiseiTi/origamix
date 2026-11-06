import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@origamix/ui';

import { Ellipsis, Pencil, Trash2, PanelsTopLeft } from 'lucide-react';

interface SidebarActionMenuProps {
  label: string;
  onRename: () => void;
  onDelete: () => void;
  layout?: { enabled: boolean; disabled: boolean; onToggle: () => void };
}

export const SidebarActionMenu = ({
  label,
  onRename,
  onDelete,
  layout,
}: SidebarActionMenuProps): React.JSX.Element => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size='icon-xs'
            variant='ghost'
            className='h-6 min-h-6 w-6 min-w-6 opacity-0 hover:bg-zinc-200 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 dark:hover:bg-zinc-800'
            aria-label={label}
          />
        }
      >
        <Ellipsis size={15} />
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label={label}>
        <DropdownMenuItem onClick={onRename}>
          <Pencil />
          编辑
        </DropdownMenuItem>
        {layout && (
          <DropdownMenuItem disabled={layout.disabled} onClick={layout.onToggle}>
            <PanelsTopLeft />
            {layout.enabled ? '关闭布局配置' : '启用布局配置'}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant='destructive' onClick={onDelete}>
          <Trash2 />
          删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
