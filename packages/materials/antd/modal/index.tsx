import React from 'react';
import { Modal as AntdModal, type ModalProps } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '../../src/runtime-material';

export interface IProps extends MaterialComponentProps, ModalProps {}

export const Modal = (props: IProps) => {
  const { children, tg_mode, tg_dropPlaceholder, ...restProps } = props;
  return (
    <AntdModal
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
      {children || tg_dropPlaceholder}
    </AntdModal>
  );
};

export default Modal;
