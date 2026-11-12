import { nanoid } from 'nanoid';
import type { MaterialEventProps } from '../../src/runtime-material';
import { Children, isValidElement } from 'react';
import { Tabs as AntdTabs, theme, type TabsProps } from 'antd';
import type { RuntimeMaterialProps } from '@';
import { useRuntimeValue } from '../runtime-state';
export type IProps = MaterialEventProps<TabsProps, 'onChange' | 'onEdit'> & RuntimeMaterialProps;
export const Tabs = (props: IProps) => {
  const {
    children,
    items,
    activeKey,
    defaultActiveKey,
    onChange,
    onEdit,
    om_mode,
    om_dropPlaceholder,
    om_setContextActions,
    om_setRuntimeState,
    om_readonly,
    ...rest
  } = props;

  const { token } = theme.useToken();
  const [pages, setPages] = useRuntimeValue('items', items, [], om_setRuntimeState);
  const [active, setActive] = useRuntimeValue<string | null>(
    'activeKey',
    activeKey,
    defaultActiveKey ?? items?.[0]?.key ?? null,
    om_setRuntimeState,
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
        onChange?.({ activeKey: next });
      }}
      style={{ backgroundColor: token.colorBgContainer, color: token.colorText }}
      onEdit={(key, action) => {
        if (action === 'add') {
          const id = `tab_${nanoid()}`;
          setPages([...pages, { key: id, label: '新页签', children: '' }]);
          setActive(id);
        } else if (typeof key === 'string') {
          if (contents.some((child) => target(child) === key)) return;
          const remaining = pages.filter((item) => item.key !== key);
          setPages(remaining);
          if (active === key) setActive(remaining[0]?.key ?? null);
        }
        onEdit?.({ action, targetKey: typeof key === 'string' ? key : null });
      }}
      items={pages.map((item, index) => ({
        ...item,
        closable: contents.some((child) => target(child) === item.key) ? false : item.closable,
        children: (
          <>
            {item.children}
            {contents.filter((child) => target(child) === item.key)}
            {om_mode === 'design' && index === 0 && !contents.length ? om_dropPlaceholder : null}
          </>
        ),
      }))}
    />
  );
};
export default Tabs;
