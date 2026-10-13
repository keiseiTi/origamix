import React from 'react';
import { Tabs as AntdTabs, theme, type TabsProps } from 'antd';
import type { RuntimeMaterialProps } from '../../src/runtime-material';

export type IProps = TabsProps & RuntimeMaterialProps;
export const Tabs = ({
  children,
  items,
  tg_mode,
  tg_dropPlaceholder,
  tg_setContextValues,
  ...rest
}: IProps) => {
  const { token } = theme.useToken();
  return (
    <AntdTabs
      key={tg_mode === 'design' ? JSON.stringify([items, rest.defaultActiveKey]) : undefined}
      {...rest}
      style={{ backgroundColor: token.colorBgContainer, color: token.colorText, ...rest.style }}
      items={items?.map((item, index) => ({
        ...item,
        children: (
          <>
            {item.children}
            {index === 0 ? (children ?? tg_dropPlaceholder) : null}
          </>
        ),
      }))}
    />
  );
};
export default Tabs;
