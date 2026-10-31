import { useRuntimeValue } from '../runtime-state';
import React from 'react';
import { Drawer as AntdDrawer, type DrawerProps } from 'antd';
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
  om_designOpen,
  om_onDesignClose,
  om_renderDesignFrame,
  om_designLayer,
  om_dropPlaceholder,
  om_setContextActions,
  om_setRuntimeState,
  om_readonly,
  customSize,
  ...rest
}: IProps) => {
  const [currentOpen, setOpen] = useRuntimeValue('open', open, false, om_setRuntimeState);
  const designing = om_mode === 'design';
  const content = children ?? om_dropPlaceholder;
  const drawer = (
    <AntdDrawer
      {...rest}
      open={designing ? Boolean(om_designOpen) : currentOpen}
      mask={
        mask === false
          ? false
          : { ...(typeof mask === 'object' ? mask : {}), closable: maskClosable ?? true }
      }
      onClose={(event) => {
        if (designing) {
          event.stopPropagation();
          om_onDesignClose?.();
          return;
        }
        setOpen(false);
        onClose?.(event);
      }}
      size={customSize ?? rest.size}
      {...(designing
        ? {
            getContainer: false,
            rootStyle: { position: 'absolute', pointerEvents: 'none' },
            drawerRender: (node) => om_renderDesignFrame?.(node) ?? node,
            styles: { wrapper: { pointerEvents: 'auto' }, body: { minHeight: 100 } },
            closable: true,
            mask: false,
            keyboard: true,
            autoFocus: false,
            focusable: { trap: false, focusTriggerAfterClose: false },
            zIndex: 1000 + (om_designLayer ?? 0),
          }
        : {})}
    >
      {content}
    </AntdDrawer>
  );
  return designing && !om_designOpen ? null : drawer;
};
export default Drawer;
