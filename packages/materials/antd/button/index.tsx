import React from 'react';
import { Button as AntdButton, type ButtonProps } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';

export interface IProps
  extends
    Pick<
      ButtonProps,
      | 'disabled'
      | 'loading'
      | 'onClick'
      | 'type'
      | 'href'
      | 'target'
      | 'ghost'
      | 'size'
      | 'danger'
      | 'block'
    >,
    MaterialComponentProps {
  text?: string;
}

export const Button = (props: IProps) => {
  const {
    text,
    om_setContextValues,
    fieldName,
    fieldLabel,
    om_setRuntimeState,
    om_mode,
    om_readonly,
    om_dropPlaceholder,
    ...restProps
  } = props;
  return <AntdButton {...restProps}>{text}</AntdButton>;
};

export default Button;
