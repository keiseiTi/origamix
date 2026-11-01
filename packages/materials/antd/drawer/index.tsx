import type { MaterialEventProps } from '../../src/runtime-material';
import { useRuntimeValue } from '../runtime-state';
import React from 'react';
import { Drawer as AntdDrawer, type DrawerProps } from 'antd';
import type { RuntimeMaterialProps } from '@';

export type IProps = MaterialEventProps<
  Omit<DrawerProps, 'width' | 'height'>,
  'onClose' | 'afterOpenChange'
> &
  RuntimeMaterialProps & { customSize?: number };
export const Drawer = (props: IProps) => {
  const {
    children,
    open,
    mask,
    maskClosable,
    afterOpenChange,
    onClose,
    om_mode,
    om_designOpen,
    om_getDesignContainer,
    om_onDesignClose,
    om_renderDesignFrame,
    om_designLayer,
    om_dropPlaceholder,
    om_setContextActions,
    om_setRuntimeState,
    om_readonly,
    customSize,
    ...rest
  } = props;

  const [currentOpen, setOpen] = useRuntimeValue('open', open, false, om_setRuntimeState);
  const designing = om_mode === 'design';
  const content = children ?? om_dropPlaceholder;
  const drawer = (
    <AntdDrawer
      {...rest}
      afterOpenChange={(open) => afterOpenChange?.({ open })}
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
        onClose?.({ action: 'onClose' });
      }}
      size={customSize ?? rest.size}
      {...(designing
        ? {
            getContainer: om_getDesignContainer,
            rootStyle: { position: 'absolute', inset: 0, pointerEvents: 'none' },
            drawerRender: (node) => om_renderDesignFrame?.(node) ?? node,
            styles: {
              mask: { position: 'absolute', pointerEvents: 'auto' },
              wrapper: { pointerEvents: 'auto' },
              body: { minHeight: 100 },
            },
            closable: true,
            mask: true,
            keyboard: true,
            autoFocus: false,
            focusable: { trap: false, focusTriggerAfterClose: false },
            zIndex: 100 + (om_designLayer ?? 0),
          }
        : {})}
    >
      {content}
    </AntdDrawer>
  );
  return designing && !om_designOpen ? null : drawer;
};
export default Drawer;
