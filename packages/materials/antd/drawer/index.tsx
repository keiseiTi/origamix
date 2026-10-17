import React from 'react';
import { Drawer as AntdDrawer, theme, type DrawerProps } from 'antd';
import type { RuntimeMaterialProps } from '../../src/runtime-material';

export type IProps = Omit<DrawerProps, 'width' | 'height'> &
  RuntimeMaterialProps & { customSize?: number };
export const Drawer = ({
  children,
  tg_mode,
  tg_dropPlaceholder,
  tg_setContextValues,
  customSize,
  ...rest
}: IProps) => {
  const { token } = theme.useToken();
  const content = children ?? tg_dropPlaceholder;
  const drawer = (
    <AntdDrawer
      {...rest}
      size={customSize ?? rest.size}
      {...(tg_mode === 'design'
        ? {
            getContainer: false,
            rootStyle: { position: 'absolute' },
            mask: false,
            keyboard: false,
            autoFocus: false,
            focusable: { trap: false, focusTriggerAfterClose: false },
            zIndex: 1,
          }
        : {})}
    >
      {content}
    </AntdDrawer>
  );
  if (tg_mode !== 'design') return drawer;
  return (
    <div
      className={`relative w-full ${rest.open ? 'min-h-80' : 'min-h-16'}`}
      style={{ backgroundColor: token.colorBgContainer, color: token.colorText }}
      data-element-id={rest['data-element-id']}
    >
      {rest.open ? (
        drawer
      ) : (
        <div className='rounded border border-dashed border-current p-4 text-sm'>
          {rest.title ?? '抽屉'}（关闭）{content}
        </div>
      )}
    </div>
  );
};
export default Drawer;
