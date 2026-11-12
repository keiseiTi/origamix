import { useState, type ReactNode } from 'react';
import { Button, Layout, Menu, Typography, theme, type MenuProps } from 'antd';
import type { ProjectShell } from '@origamix/runtime';

type ShellPage = { pageId: string; name: string; href: string };
type MenuEntry = NonNullable<MenuProps['items']>[number];

interface ApplicationShellProps {
  config: ProjectShell;
  title: string;
  enabled: boolean;
  variant: 'side' | 'top' | 'mix';
  pages: readonly ShellPage[];
  currentPageId: string;
  onNavigate: (pageId: string) => void;
  children: ReactNode;
}

export const ApplicationShell = ({
  config,
  title,
  enabled,
  variant,
  pages,
  currentPageId,
  onNavigate,
  children,
}: ApplicationShellProps): React.JSX.Element => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>();
  const { token } = theme.useToken();
  if (!enabled) return <>{children}</>;

  const entries = new Map((config.navigation ?? []).map((item) => [item.id, item]));
  const pagesById = new Map(pages.map((page) => [page.pageId, page]));
  const menu = new Map<string | undefined, NonNullable<ProjectShell['navigation']>>();
  for (const item of entries.values()) {
    if (item.hidden) continue;
    const siblings = menu.get(item.parentId) ?? [];
    siblings.push(item);
    menu.set(item.parentId, siblings);
  }
  const roots = menu.get(undefined) ?? [];
  const activeItem = [...entries.values()].find((item) => {
    if (item.hidden || item.pageId !== currentPageId) return false;
    let parent = item.parentId;
    while (parent) {
      const ancestor = entries.get(parent);
      if (!ancestor || ancestor.hidden) return false;
      parent = ancestor.parentId;
    }
    return true;
  });
  const activeParents: string[] = [];
  let parent = activeItem?.parentId;
  while (parent) {
    activeParents.unshift(parent);
    parent = entries.get(parent)?.parentId;
  }
  const activeRoot = activeParents[0] ?? activeItem?.id;
  const group =
    roots.find((item) => item.id === selectedGroup)?.id ??
    roots.find((item) => item.id === activeRoot)?.id ??
    roots[0]?.id;

  const renderItems = (parentId?: string): MenuEntry[] =>
    (menu.get(parentId) ?? []).map((item) => {
      const page = item.pageId ? pagesById.get(item.pageId) : undefined;
      const label = item.title || page?.name || '未选择页面';
      const link = page && (
        <a
          href={page.href}
          aria-current={page.pageId === currentPageId ? 'page' : undefined}
          onClick={(event) => {
            if (
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            onNavigate(page.pageId);
          }}
        >
          {label}
        </a>
      );
      const children = renderItems(item.id);
      if (children.length)
        return {
          key: item.id,
          label,
          children: page ? [{ key: `page:${item.id}`, label: link }, ...children] : children,
        };
      return { key: item.id, label: link ?? label, disabled: !page };
    });
  const activeKey =
    activeItem && menu.has(activeItem.id) ? `page:${activeItem.id}` : activeItem?.id;
  const navigation = (
    <Menu
      aria-label='应用菜单'
      mode={variant === 'top' ? 'horizontal' : 'inline'}
      items={renderItems(variant === 'mix' ? group : undefined)}
      selectedKeys={activeKey ? [activeKey] : []}
      defaultOpenKeys={activeParents}
      className={variant === 'top' ? 'min-w-0 flex-1' : undefined}
      onClick={({ key, domEvent }) => {
        if (domEvent.target instanceof Element && domEvent.target.closest('a')) return;
        const pageId = entries.get(key.replace(/^page:/, ''))?.pageId;
        if (pageId) onNavigate(pageId);
      }}
    />
  );
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header
        className='flex min-w-0 items-center gap-4'
        style={{ background: token.colorBgContainer }}
      >
        <div className='flex shrink-0 items-center gap-2'>
          {config.logo && <img src={config.logo} alt='' className='size-7 object-contain' />}
          <Typography.Text strong>{config.title || title}</Typography.Text>
        </div>
        {variant === 'top' && navigation}
        {variant === 'mix' && (
          <Menu
            aria-label='一级菜单'
            mode='horizontal'
            className='min-w-0 flex-1'
            selectedKeys={group ? [group] : []}
            items={roots.map((item) => ({
              key: item.id,
              label: item.title || (item.pageId && pagesById.get(item.pageId)?.name) || '未命名',
            }))}
            onClick={({ key }) => {
              setSelectedGroup(key);
              const pageId = entries.get(key)?.pageId;
              if (pageId) onNavigate(pageId);
            }}
          />
        )}
        {variant !== 'top' && (
          <Button
            className='ml-auto'
            aria-expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? '展开菜单' : '收起菜单'}
          </Button>
        )}
      </Layout.Header>
      <Layout hasSider={variant !== 'top' && !collapsed}>
        {variant !== 'top' && !collapsed && (
          <Layout.Sider
            theme='light'
            width={176}
            className='overflow-auto'
            style={{ background: token.colorBgContainer }}
          >
            {navigation}
          </Layout.Sider>
        )}
        <Layout.Content className='min-w-0'>{children}</Layout.Content>
      </Layout>
    </Layout>
  );
};
