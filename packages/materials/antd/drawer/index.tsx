import React from 'react';
import { Drawer as AntdDrawer, type DrawerProps } from 'antd';
import type { MaterialComponentProps } from '@tangramino/base-editor';

interface IProps extends MaterialComponentProps, DrawerProps {}

export const Drawer = (props: IProps) => {
  const { children, tg_mode, tg_dropPlaceholder, ...restProps } = props;
  return (
    <AntdDrawer
      {...restProps}
      classNames={
        tg_mode === 'design'
          ? {
              mask: 'absolute!',
              wrapper: 'absolute!',
            }
          : undefined
      }
    >
      {children}
    </AntdDrawer>
  );
};

export default Drawer;
