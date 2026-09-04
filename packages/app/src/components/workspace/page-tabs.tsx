import { Button } from '@heroui/react';
import { X } from 'lucide-react';
import type { PageItem } from '../sidebar';

interface PageTabsProps {
  pages: PageItem[];
  activePageId: string | null;
  sidebarCollapsed: boolean;
  isMacDesktop: boolean;
  onSelect: (pageId: string) => void;
  onClose: (pageId: string) => void;
}

export function PageTabs({
  pages,
  activePageId,
  sidebarCollapsed,
  isMacDesktop,
  onSelect,
  onClose,
}: PageTabsProps): React.JSX.Element {
  return (
    <nav
      aria-label='已打开页面'
      className='window-drag-region flex h-10 shrink-0 items-stretch overflow-x-auto bg-zinc-50 dark:bg-zinc-900'
    >
      {sidebarCollapsed && isMacDesktop && (
        <span
          aria-hidden='true'
          className='window-no-drag-region w-[108px] shrink-0 border-r border-b border-zinc-200 dark:border-zinc-800'
        />
      )}
      {sidebarCollapsed && !isMacDesktop && (
        <span
          aria-hidden='true'
          className='window-no-drag-region w-10 shrink-0 border-b border-zinc-200 dark:border-zinc-800'
        />
      )}
      {pages.map((page, index) => {
        const active = page.id === activePageId;
        return (
          <div
            key={page.id}
            className={`window-no-drag-region group flex min-w-32 max-w-56 items-center border-r border-zinc-200 px-1 dark:border-zinc-800 ${
              sidebarCollapsed && !isMacDesktop && index === 0 ? 'border-l' : ''
            } ${
              active
                ? 'bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100'
                : 'border-b border-zinc-200 text-zinc-500 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            <button
              type='button'
              className='h-full min-w-0 flex-1 truncate px-2 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary'
              aria-current={active ? 'page' : undefined}
              title={page.name}
              onClick={() => onSelect(page.id)}
            >
              {page.name}
            </button>
            <Button
              isIconOnly
              size='sm'
              variant='ghost'
              className='h-6 min-h-6 w-6 min-w-6 opacity-0 group-hover:opacity-100 focus:opacity-100'
              aria-label={`关闭 ${page.name}`}
              onPress={() => onClose(page.id)}
            >
              <X size={14} />
            </Button>
          </div>
        );
      })}
      <span
        aria-hidden='true'
        className='window-drag-region min-w-0 flex-1 border-b border-zinc-200 dark:border-zinc-800'
      />
    </nav>
  );
}
