import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@origamix/ui';

import { Ellipsis, Pencil, Trash2, ArrowUpCircle } from 'lucide-react';

interface SidebarActionMenuProps {
  label: string;
  onRename: () => void;
  onDelete: () => void;
  onUpgrade?: () => void;
}

export const SidebarActionMenu = ({
  label,
  onRename,
  onDelete,
  onUpgrade,
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
        {onUpgrade && (
          <DropdownMenuItem onClick={onUpgrade}>
            <ArrowUpCircle />
            升级项目
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
