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
  om_mode,
  om_dropPlaceholder,
  om_setContextValues,
  om_setRuntimeState,
  om_readonly,
  customSize,
  ...rest
}: IProps) => {
  const [currentOpen, setOpen] = useRuntimeValue('open', open, false, om_setRuntimeState);
  const { token } = theme.useToken();
  const content = children ?? om_dropPlaceholder;
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
      {...(om_mode === 'design'
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
  if (om_mode !== 'design') return drawer;
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
