import { Children, isValidElement } from 'react';
import { Tabs as AntdTabs, theme, type TabsProps } from 'antd';
import type { RuntimeMaterialProps } from '@';
import { useRuntimeValue } from '../runtime-state';
export type IProps = TabsProps & RuntimeMaterialProps;
export const Tabs = ({
  children,
  items,
  activeKey,
  defaultActiveKey,
  onChange,
  onEdit,
  tg_mode,
  tg_dropPlaceholder,
  tg_setContextValues,
  tg_setRuntimeState,
  ...rest
}: IProps) => {
  const { token } = theme.useToken();
  const [pages, setPages] = useRuntimeValue('items', items, [], tg_setRuntimeState);
  const [active, setActive] = useRuntimeValue<string | null>(
    'activeKey',
    activeKey,
    defaultActiveKey ?? pages[0]?.key ?? null,
    tg_setRuntimeState,
  );
  const contents = Children.toArray(children);
  const target = (child: (typeof contents)[number]) =>
    isValidElement<{ data?: Record<string, unknown>; tabKey?: unknown }>(child)
      ? String(child.props.tabKey ?? child.props.data?.tabKey ?? pages[0]?.key)
      : String(pages[0]?.key);
  return (
    <AntdTabs
      {...rest}
      activeKey={active ?? undefined}
      onChange={(next) => {
        setActive(next);
        onChange?.(next);
      }}
      style={{ backgroundColor: token.colorBgContainer, color: token.colorText }}
      onEdit={(key, action) => {
        if (action === 'add') {
          const id = `tab_${crypto.randomUUID()}`;
          setPages([...pages, { key: id, label: '新页签', children: '' }]);
          setActive(id);
        } else if (typeof key === 'string') {
          if (contents.some((child) => target(child) === key)) return;
          const remaining = pages.filter((item) => item.key !== key);
          setPages(remaining);
          if (active === key) setActive(remaining[0]?.key ?? null);
        }
        onEdit?.(key, action);
      }}
      items={pages.map((item, index) => ({
        ...item,
        closable: contents.some((child) => target(child) === item.key) ? false : item.closable,
        children: (
          <>
            {item.children}
            {contents.filter((child) => target(child) === item.key)}
            {tg_mode === 'design' && index === 0 && !contents.length ? tg_dropPlaceholder : null}
          </>
        ),
      }))}
    />
  );
};
export default Tabs;
