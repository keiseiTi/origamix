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
      | 'shape'
      | 'href'
      | 'target'
      | 'ghost'
      | 'size'
      | 'danger'
      | 'block'
      | 'htmlType'
    >,
    MaterialComponentProps {
  text?: string;
}

export const Button = (props: IProps) => {
  const { text, tg_setContextValues, fieldName, fieldLabel, tg_setRuntimeState, ...restProps } =
    props;
  return <AntdButton {...restProps}>{text}</AntdButton>;
};

export default Button;
