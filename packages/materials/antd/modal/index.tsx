import React from 'react';
import { Modal as AntdModal, theme, type ModalProps } from 'antd';
import type { RuntimeMaterialProps } from '@';

export type IProps = ModalProps &
  RuntimeMaterialProps & {
    showFooter?: boolean;
    okDisabled?: boolean;
    cancelDisabled?: boolean;
  };
export const Modal = ({
  children,
  tg_mode,
  tg_dropPlaceholder,
  tg_setContextValues,
  showFooter,
  okDisabled,
  cancelDisabled,
  okButtonProps,
  cancelButtonProps,
  ...rest
}: IProps) => {
  const { token } = theme.useToken();
  const content = children ?? tg_dropPlaceholder;
  const modal = (
    <AntdModal
      {...rest}
      footer={showFooter === false ? null : rest.footer}
      okButtonProps={{
        ...okButtonProps,
        ...(okDisabled !== undefined ? { disabled: okDisabled } : {}),
      }}
      cancelButtonProps={{
        ...cancelButtonProps,
        ...(cancelDisabled !== undefined ? { disabled: cancelDisabled } : {}),
      }}
      {...(tg_mode === 'design'
        ? {
            getContainer: false,
            keyboard: false,
            scrollLock: false,
            focusable: { trap: false, focusTriggerAfterClose: false },
            classNames: { wrapper: 'absolute!' },
            styles: { wrapper: { position: 'absolute' } },
            mask: false,
            zIndex: 1,
          }
        : {})}
    >
      {content}
    </AntdModal>
  );
  if (tg_mode !== 'design') return modal;
  return (
    <div
      className={`relative w-full ${rest.open ? 'min-h-80' : 'min-h-16'}`}
      style={{ backgroundColor: token.colorBgContainer, color: token.colorText }}
      data-element-id={rest['data-element-id']}
    >
      {rest.open ? (
        modal
      ) : (
        <div className='rounded border border-dashed border-current p-4 text-sm'>
          {rest.title ?? '弹窗'}（关闭）{content}
        </div>
      )}
    </div>
  );
};
export default Modal;
