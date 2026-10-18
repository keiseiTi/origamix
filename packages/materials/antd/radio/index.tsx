import React from 'react';
import { Radio as AntdRadio, type RadioGroupProps } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';

export interface IProps extends RadioGroupProps, MaterialComponentProps {
  label?: string;
  optionDisplayButton?: boolean;
}

export const Radio = (props: IProps) => {
  const { label, optionDisplayButton, tg_setContextValues, ...rest } = props;

  if (optionDisplayButton) {
    return (
      <AntdRadio.Group optionType='button' buttonStyle='solid' {...rest}>
        {label}
      </AntdRadio.Group>
    );
  }

  return <AntdRadio.Group {...rest}>{label}</AntdRadio.Group>;
};

export default Radio;
