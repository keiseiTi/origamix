import { useRuntimeValue } from '../runtime-state';
import React from 'react';
import { Modal as AntdModal, type ModalProps } from 'antd';
import type { RuntimeMaterialProps } from '@';

export type IProps = ModalProps &
  RuntimeMaterialProps & {
    showFooter?: boolean;
    okDisabled?: boolean;
    cancelDisabled?: boolean;
  };
export const Modal = ({
  children,
  open,
  mask,
  maskClosable,
  onCancel,
  onOk,
  om_mode,
  om_designOpen,
  om_onDesignClose,
  om_renderDesignFrame,
  om_designLayer,
  om_dropPlaceholder,
  om_setContextActions,
  om_setRuntimeState,
  om_readonly,
  showFooter,
  okDisabled,
  cancelDisabled,
  okButtonProps,
  cancelButtonProps,
  ...rest
}: IProps) => {
  const [currentOpen, setOpen] = useRuntimeValue('open', open, false, om_setRuntimeState);
  const designing = om_mode === 'design';
  const content = children ?? om_dropPlaceholder;
  const modal = (
    <AntdModal
      {...rest}
      open={designing ? Boolean(om_designOpen) : currentOpen}
      mask={
        mask === false
          ? false
          : { ...(typeof mask === 'object' ? mask : {}), closable: maskClosable ?? true }
      }
      onCancel={(event) => {
        if (designing) {
          event.stopPropagation();
          om_onDesignClose?.();
          return;
        }
        setOpen(false);
        onCancel?.(event);
      }}
      onOk={(event) => {
        if (designing) {
          event.stopPropagation();
          return;
        }
        if (!onOk) setOpen(false);
        onOk?.(event);
      }}
      footer={showFooter === false ? null : rest.footer}
      okButtonProps={{
        ...okButtonProps,
        ...(okDisabled !== undefined ? { disabled: okDisabled } : {}),
      }}
      cancelButtonProps={{
        ...cancelButtonProps,
        ...(cancelDisabled !== undefined ? { disabled: cancelDisabled } : {}),
      }}
      {...(designing
        ? {
            getContainer: false,
            closable: true,
            keyboard: true,
            modalRender: (node) => om_renderDesignFrame?.(node) ?? node,
            scrollLock: false,
            focusable: { trap: false, focusTriggerAfterClose: false },
            classNames: { wrapper: 'absolute!' },
            styles: {
              wrapper: { position: 'absolute', pointerEvents: 'none' },
              body: { minHeight: 100 },
            },
            mask: false,
            zIndex: 1000 + (om_designLayer ?? 0),
          }
        : {})}
    >
      {content}
    </AntdModal>
  );
  return designing && !om_designOpen ? null : modal;
};
export default Modal;
