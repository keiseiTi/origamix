import { useState, type ReactNode } from 'react';
import { Button } from '@origamix/ui';
import { isProjectLogo, type ProjectShell, type InitialLayoutVariant } from '@origamix/shared';

interface LayoutEffectProps {
  config: ProjectShell;
  title: string;
  enabled: boolean;
  variant: InitialLayoutVariant;
  pages: readonly { pageId: string; name: string }[];
  currentPageId?: string;
  onNavigate: (pageId: string) => void;
  children: ReactNode;
}

/** Interactive illustration of the draft project layout. */
export const LayoutEffect = ({
  config,
  title,
  enabled,
  variant,
  pages,
  currentPageId,
  onNavigate,
  children,
}: LayoutEffectProps): React.JSX.Element => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('');
  const items = config.navigation ?? [];
  const roots = items.filter((item) => !item.parentId && !item.hidden);
  const activeItem = items.find((item) => item.pageId === currentPageId);
  let activeRoot = activeItem;
  const ancestors = new Set<string>();
  while (activeRoot?.parentId && !ancestors.has(activeRoot.id)) {
    ancestors.add(activeRoot.id);
    activeRoot = items.find((item) => item.id === activeRoot?.parentId);
  }
  const group = roots.find((item) => item.id === selectedGroup) ?? activeRoot ?? roots[0];

  const renderItems = (parentId?: string): ReactNode =>
    items
      .filter((item) => item.parentId === parentId && !item.hidden)
      .map((item) => {
        const page = pages.find((page) => page.pageId === item.pageId);
        const label = item.title || page?.name || '未选择页面';
        const hasChildren = items.some((child) => child.parentId === item.id && !child.hidden);
        const content = page ? (
          <Button
            type='button'
            size='sm'
            variant={page.pageId === currentPageId ? 'secondary' : 'ghost'}
            aria-current={page.pageId === currentPageId ? 'page' : undefined}
            className='w-full justify-start'
            onClick={() => onNavigate(page.pageId)}
          >
            {label}
          </Button>
        ) : (
          <span className='block px-3 py-2 text-sm'>{label}</span>
        );
        return (
          <li key={item.id} className='min-w-0'>
            {hasChildren ? (
              <details open={variant !== 'top'} className='relative'>
                <summary className='cursor-pointer rounded-md focus-visible:outline-2'>
                  {label}
                </summary>
                <ul
                  className={
                    variant === 'top'
                      ? 'absolute top-full left-0 z-10 min-w-40 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-zinc-900'
                      : 'ml-3 border-l border-zinc-200 pl-2 dark:border-zinc-700'
                  }
                >
                  {page && <li>{content}</li>}
                  {renderItems(item.id)}
                </ul>
              </details>
            ) : (
              content
            )}
          </li>
        );
      });
  if (!enabled) return <>{children}</>;
  const brand = (
    <div className='flex min-w-0 items-center gap-2 px-4 py-3 font-semibold'>
      {config.logo && isProjectLogo(config.logo) && (
        <img src={config.logo} alt='' className='size-7 shrink-0 object-contain' />
      )}
      <span className='truncate'>{config.title || title}</span>
    </div>
  );
  const navigation = (
    <nav aria-label='应用菜单' className='p-3'>
      <ul className={variant === 'top' ? 'flex flex-wrap items-start gap-2' : 'grid gap-1'}>
        {renderItems(variant === 'mix' ? group?.id : undefined)}
      </ul>
      {!items.length && (
        <p className='px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400'>暂无菜单</p>
      )}
    </nav>
  );
  return (
    <div className='flex min-h-96 flex-col bg-background text-foreground lg:min-h-full'>
      <header className='flex shrink-0 flex-wrap items-center justify-between border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'>
        {brand}
        {variant === 'mix' && (
          <nav aria-label='一级菜单' className='flex flex-wrap gap-1 p-2'>
            {roots.map((item) => (
              <Button
                size='sm'
                variant='ghost'
                key={item.id}
                type='button'
                aria-pressed={group?.id === item.id}
                onClick={() => {
                  setSelectedGroup(item.id);
                  if (item.pageId) onNavigate(item.pageId);
                }}
                className={`rounded-md px-3 py-2 text-sm hover:bg-zinc-100 focus-visible:outline-2 dark:hover:bg-zinc-800 ${group?.id === item.id ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200' : ''}`}
              >
                {item.title || pages.find((page) => page.pageId === item.pageId)?.name || '未命名'}
              </Button>
            ))}
          </nav>
        )}
        {variant === 'top' ? (
          navigation
        ) : (
          <Button
            size='sm'
            variant='ghost'
            type='button'
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
            className='m-2 rounded px-3 py-2 text-xs hover:bg-zinc-100 focus-visible:outline-2 dark:hover:bg-zinc-800'
          >
            {collapsed ? '展开菜单' : '收起菜单'}
          </Button>
        )}
      </header>
      <div className='flex min-h-0 flex-1'>
        {variant !== 'top' && !collapsed && (
          <aside
            className={`w-44 shrink-0 overflow-auto border-r border-zinc-200 ${variant === 'mix' ? 'bg-zinc-100 dark:bg-zinc-900' : 'bg-white dark:bg-zinc-950'} dark:border-zinc-800`}
          >
            {navigation}
          </aside>
        )}
        <main className='min-w-0 flex-1'>{children}</main>
      </div>
    </div>
  );
};
