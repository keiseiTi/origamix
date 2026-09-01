import React from 'react';
import { Button as AntdButton, type ButtonProps } from 'antd';
import type { MaterialComponentProps } from '@tangramino/base-editor';

interface IProps
  extends Pick<
      ButtonProps,
      'disabled' | 'loading' | 'onClick' | 'type' | 'shape' | 'href' | 'target' | 'ghost'
    >,
    MaterialComponentProps {
  text?: string;
}

export const Button = (props: IProps) => {
  const { text, tg_setContextValues, ...restProps } = props;
  return <AntdButton {...restProps}>{text}</AntdButton>;
};

export default Button;
