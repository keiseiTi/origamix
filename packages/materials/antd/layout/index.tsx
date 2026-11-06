import { FileText } from 'lucide-react';
import { useState, type ReactNode, type ComponentProps } from 'react';
import { Layout as AntdLayout, Menu, Button, theme } from 'antd';
import { useLayoutNavigation } from '@origamix/runtime';
import type { RuntimeMaterialProps } from '../../src/index';
import { layoutDefaults } from './schema';

type Config = Record<string, unknown>;
const Navigation = ({ horizontal }: { horizontal: boolean }) => {
  const navigation = useLayoutNavigation();
  const { token } = theme.useToken();
  return (
    <Menu
      aria-label={horizontal ? '顶部页面导航' : '侧栏页面导航'}
      mode={horizontal ? 'horizontal' : 'inline'}
      style={{ minWidth: 0, flex: 1, background: token.colorBgContainer }}
      selectedKeys={navigation ? [navigation.currentPageId] : []}
      items={
        navigation?.pages.map((page) => ({
          key: page.pageId,
          title: page.name,
          icon: <FileText size={16} aria-hidden='true' />,
          label: (
            <a
              href={page.path}
              aria-current={navigation.currentPageId === page.pageId ? 'page' : undefined}
              onClick={(event) => {
                if (
                  event.button === 0 &&
                  !event.metaKey &&
                  !event.ctrlKey &&
                  !event.shiftKey &&
                  !event.altKey &&
                  navigation.navigateToPage(page.pageId)
                )
                  event.preventDefault();
              }}
            >
              {page.name}
            </a>
          ),
        })) ?? [{ key: 'placeholder', label: '项目页面导航', disabled: true }]
      }
    />
  );
};
export const Layout = ({
  children,
  om_dropPlaceholder,
  ...props
}: RuntimeMaterialProps & Config & { children?: ReactNode }) => {
  const config: Config = { ...layoutDefaults, ...props };
  const side = config.variant === 'side' || config.variant === 'side-top';
  const { token } = theme.useToken();
  return (
    <AntdLayout
      hasSider={side}
      style={{
        minHeight: Number(config.minHeight),
        width: '100%',
        background: token.colorBgLayout,
      }}
    >
      {children ?? om_dropPlaceholder}
    </AntdLayout>
  );
};
const Sider = ({ config, children }: { config: Config; children: ReactNode }) => {
  const [collapsed, setCollapsed] = useState(config.defaultCollapsed === true);
  const { token } = theme.useToken();
  const toggle = (
    <Button
      type='text'
      block
      aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
      onClick={(event) => {
        event.stopPropagation();
        setCollapsed(!collapsed);
      }}
      style={{ borderRadius: 0, color: token.colorText }}
    >
      {collapsed ? '展开' : '折叠'}
    </Button>
  );
  return (
    <div style={{ position: 'relative', height: '100%', display: 'flex' }}>
      <AntdLayout.Sider
        aria-label='侧栏区域'
        theme='light'
        width={Number(config.siderWidth)}
        collapsedWidth={Number(config.collapsedWidth)}
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        breakpoint={
          config.breakpoint === 'none'
            ? undefined
            : (config.breakpoint as ComponentProps<typeof AntdLayout.Sider>['breakpoint'])
        }
        style={{ height: '100%', background: token.colorBgContainer }}
      >
        <div className='flex h-full flex-col'>
          {config.siderMenu === true && <Navigation horizontal={false} />}
          {children}
          {config.collapsible === true && !(collapsed && config.collapsedWidth === 0) && (
            <div className='mt-auto shrink-0'>{toggle}</div>
          )}
        </div>
      </AntdLayout.Sider>
      {config.collapsible === true && collapsed && config.collapsedWidth === 0 && (
        <div
          className='absolute top-2 left-0 z-10 w-12 rounded'
          style={{ background: token.colorBgContainer }}
        >
          {toggle}
        </div>
      )}
    </div>
  );
};
export const LayoutRegion = ({
  region,
  enabled,
  config: input,
  children,
  om_dropPlaceholder,
}: RuntimeMaterialProps & {
  region?: string;
  enabled?: boolean;
  config?: Config;
  children?: ReactNode;
}) => {
  const { token } = theme.useToken();
  const config: Config = { ...layoutDefaults, ...input };
  if (!enabled) return null;
  const content = children ?? om_dropPlaceholder;
  switch (region) {
    case 'body':
      return (
        <AntdLayout
          hasSider={config.variant === 'top-side'}
          style={{ minWidth: 0, height: '100%', background: token.colorBgLayout }}
        >
          {content}
        </AntdLayout>
      );
    case 'header':
      return (
        <AntdLayout.Header
          aria-label='顶部区域'
          style={{
            height: Number(config.headerHeight),
            lineHeight: 'normal',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            background: token.colorBgContainer,
            color: token.colorText,
          }}
        >
          <strong className='shrink-0'>{String(config.brand)}</strong>
          {config.headerMenu === true && <Navigation horizontal />}
          {content}
        </AntdLayout.Header>
      );
    case 'sider':
      return (
        <Sider key={String(config.defaultCollapsed)} config={config}>
          {content}
        </Sider>
      );
    case 'footer':
      return (
        <AntdLayout.Footer
          aria-label='页脚区域'
          style={{
            textAlign: 'center',
            background: token.colorBgContainer,
            color: token.colorText,
          }}
        >
          {String(config.footerText)}
          {content}
        </AntdLayout.Footer>
      );
    default:
      return (
        <AntdLayout.Content
          aria-label='页面内容区域'
          style={{
            minWidth: 0,
            minHeight: 0,
            height: '100%',
            padding: Number(config.contentPadding),
            background: token.colorBgLayout,
            color: token.colorText,
          }}
        >
          {content}
        </AntdLayout.Content>
      );
  }
};
