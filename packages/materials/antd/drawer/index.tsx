import { useRuntimeValue } from '../runtime-state';
import React from 'react';
import { Drawer as AntdDrawer, theme, type DrawerProps } from 'antd';
import type { RuntimeMaterialProps } from '@';

export type IProps = Omit<DrawerProps, 'width' | 'height'> &
  RuntimeMaterialProps & { customSize?: number };
export const Drawer = ({
  children,
  open,
  mask,
  maskClosable,
  onClose,
  tg_mode,
  tg_dropPlaceholder,
  tg_setContextValues,
  tg_setRuntimeState,
  customSize,
  ...rest
}: IProps) => {
  const [currentOpen, setOpen] = useRuntimeValue('open', open, false, tg_setRuntimeState);
  const { token } = theme.useToken();
  const content = children ?? tg_dropPlaceholder;
  const drawer = (
    <AntdDrawer
      {...rest}
      open={currentOpen}
      mask={
        mask === false
          ? false
          : { ...(typeof mask === 'object' ? mask : {}), closable: maskClosable ?? true }
      }
      onClose={(event) => {
        setOpen(false);
        onClose?.(event);
      }}
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
      className={`relative w-full ${currentOpen ? 'min-h-80' : 'min-h-16'}`}
      style={{ backgroundColor: token.colorBgContainer, color: token.colorText }}
      data-element-id={rest['data-element-id']}
    >
      {currentOpen ? (
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
