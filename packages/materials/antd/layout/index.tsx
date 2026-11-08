import { FileText } from 'lucide-react';
import { createContext, useContext, useState, type ReactNode, type CSSProperties } from 'react';
import { Breadcrumb, Button, Layout as AntdLayout, Menu, theme } from 'antd';
import { useLayoutNavigation } from '@origamix/runtime';
import type { RuntimeMaterialProps } from '../../src/index';
import { layoutDefaults, layoutRegionDefaults } from './schema';

type Config = Record<string, unknown>;
const LayoutContext = createContext({
  scrollTop: 0,
  collapsed: false,
  setCollapsed: (value: boolean): void => {
    void value;
  },
  siderWidth: 240,
  headerHeight: 64,
  fixedHeader: false,
  section: 'workspace',
  setSection: (value: string): void => {
    void value;
  },
});
const Navigation = ({ horizontal, config }: { horizontal: boolean; config: Config }) => {
  const navigation = useLayoutNavigation();
  const state = useContext(LayoutContext);
  const mixed = config.variant === 'mix';
  const sections = [
    { key: 'workspace', label: '工作台' },
    { key: 'management', label: '系统管理' },
  ];
  const pages = navigation?.pages.map((page) => ({
    key: page.pageId,
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
  }));
  const mockItems =
    state.section === 'management'
      ? [
          { key: 'users', label: '用户管理' },
          { key: 'settings', label: '系统设置' },
        ]
      : [
          { key: 'overview', label: '概览' },
          { key: 'list', label: '列表页' },
        ];
  return (
    <Menu
      aria-label={horizontal ? '顶部菜单' : '左侧菜单'}
      mode={horizontal ? 'horizontal' : 'inline'}
      style={{ minWidth: 0, flex: 1, background: 'transparent', color: 'inherit' }}
      selectedKeys={
        horizontal && mixed ? [state.section] : navigation ? [navigation.currentPageId] : undefined
      }
      defaultSelectedKeys={['overview']}
      onClick={({ key }) => {
        if (horizontal && mixed) state.setSection(key);
      }}
      items={
        horizontal && mixed
          ? sections
          : (pages ??
            mockItems.map((item) => ({ ...item, icon: <FileText size={16} aria-hidden='true' /> })))
      }
    />
  );
};
const Brand = ({ config }: { config: Config }) => (
  <div
    className='flex min-w-0 shrink-0 items-center gap-2 overflow-hidden px-4'
    style={{ height: 64 }}
  >
    {config.logo ? (
      <img src={String(config.logo)} alt='' className='h-8 w-8 shrink-0 object-contain' />
    ) : null}
    <strong className='truncate'>{String(config.title ?? '')}</strong>
  </div>
);
export const Layout = ({
  children,
  om_dropPlaceholder,
  om_mode,
  ...props
}: RuntimeMaterialProps & Config & { children?: ReactNode }) => {
  const config: Config = {
    ...layoutDefaults,
    ...props,
    ...(props.regionConfig as Config | undefined),
  };
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [section, setSection] = useState('workspace');
  // Region values are collected from the rendered schema by the derived root config.
  const state = {
    collapsed,
    scrollTop,
    setCollapsed,
    section,
    setSection,
    siderWidth: Number(config.siderWidth ?? 240),
    headerHeight: Number(config.headerHeight ?? 64),
    fixedHeader: config.fixedHeader === true,
  };
  return (
    <LayoutContext.Provider value={state}>
      <div
        style={{
          height: om_mode === 'design' ? '100%' : '100vh',
          position: 'relative',
          transform: 'translateZ(0)',
        }}
      >
        <div
          style={{ height: '100%', overflow: 'auto' }}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <AntdLayout
            hasSider={config.variant === 'side'}
            style={{
              minHeight: '100%',
              height: '100%',
              width: '100%',
              background: token.colorBgLayout,
            }}
          >
            {children ?? om_dropPlaceholder}
          </AntdLayout>
        </div>
      </div>
    </LayoutContext.Provider>
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
  const state = useContext(LayoutContext);
  const config: Config = {
    ...layoutDefaults,
    ...layoutRegionDefaults[region as keyof typeof layoutRegionDefaults],
    ...input,
  };
  const navigation = useLayoutNavigation();
  if (!enabled) return null;
  const content = children ?? om_dropPlaceholder;
  const side = config.variant === 'side';
  const sidebarWidth =
    state.collapsed && config.collapsible !== false
      ? 80
      : Number(config.siderWidth ?? state.siderWidth);
  const headerHeight = Number(config.headerHeight ?? state.headerHeight);
  const container: CSSProperties = { minWidth: 0, minHeight: 0, background: token.colorBgLayout };
  switch (region) {
    case 'body':
      return (
        <AntdLayout
          hasSider={!side && config.variant !== 'top'}
          style={{ ...container, height: '100%' }}
        >
          {content}
        </AntdLayout>
      );
    case 'main':
      return (
        <AntdLayout style={{ ...container, height: '100%', flexDirection: 'column' }}>
          {content}
        </AntdLayout>
      );
    case 'header':
      return (
        <div style={{ height: headerHeight, flexShrink: 0 }}>
          <AntdLayout.Header
            aria-label='顶部区域'
            style={{
              height: headerHeight,
              lineHeight: 'normal',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              background: String(config.headerBackground || token.colorBgContainer),
              color: token.colorText,
              ...(config.fixedHeader
                ? { position: 'fixed', top: 0, left: side ? sidebarWidth : 0, right: 0, zIndex: 20 }
                : {}),
            }}
          >
            {!side && <Brand config={config} />}
            {!side && <Navigation horizontal config={config} />}
            {children}
          </AntdLayout.Header>
        </div>
      );
    case 'sider': {
      const top = side
        ? 0
        : Math.max(0, state.headerHeight - (state.fixedHeader ? 0 : state.scrollTop));
      return (
        <div style={{ width: sidebarWidth, height: '100%', flexShrink: 0 }}>
          <AntdLayout.Sider
            aria-label='侧栏区域'
            theme='light'
            width={Number(config.siderWidth)}
            collapsedWidth={80}
            collapsed={state.collapsed && config.collapsible === true}
            collapsible={config.collapsible === true}
            onCollapse={state.setCollapsed}
            trigger={null}
            style={{
              background: token.colorBgContainer,
              height: config.fixSiderbar ? undefined : '100%',
              ...(config.fixSiderbar
                ? {
                    position: 'fixed',
                    top,
                    bottom: 0,
                    left: 0,
                    zIndex: 15,
                    overflowY: 'auto',
                  }
                : {}),
            }}
          >
            <div className='flex min-h-full flex-col'>
              {side && <Brand config={config} />}
              <Navigation horizontal={false} config={config} />
              {children}
              {config.collapsible === true && (
                <Button
                  type='text'
                  block
                  aria-label={state.collapsed ? '展开侧栏' : '收起侧栏'}
                  onClick={() => state.setCollapsed(!state.collapsed)}
                  className='mt-auto shrink-0'
                >
                  {state.collapsed ? '展开' : '收起'}
                </Button>
              )}
            </div>
          </AntdLayout.Sider>
        </div>
      );
    }
    case 'footer':
      return (
        <AntdLayout.Footer
          aria-label='页脚区域'
          style={{ textAlign: 'center', background: token.colorBgLayout, color: token.colorText }}
        >
          {String(config.footerText)}
          {children}
        </AntdLayout.Footer>
      );
    default:
      return (
        <AntdLayout.Content
          aria-label='页面主体'
          style={{ ...container, flex: 1, padding: Number(config.contentMargin) }}
        >
          <div
            style={{
              width: '100%',
              maxWidth:
                config.contentWidth === 'Fixed' ? Number(config.contentMaxWidth) : undefined,
              margin: '0 auto',
            }}
          >
            {config.breadcrumb === true && (
              <Breadcrumb
                style={{ marginBottom: 16 }}
                items={[
                  { title: '首页' },
                  {
                    title:
                      navigation?.pages.find((page) => page.pageId === navigation.currentPageId)
                        ?.name ?? '当前页面',
                  },
                ]}
              />
            )}
            <div
              style={{
                padding: Number(config.contentPadding),
                minHeight: 280,
                background: token.colorBgContainer,
                borderRadius: token.borderRadiusLG,
              }}
            >
              {content}
            </div>
          </div>
        </AntdLayout.Content>
      );
  }
};
