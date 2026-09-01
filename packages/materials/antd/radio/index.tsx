import React from 'react';
import { Radio as AntdRadio, type RadioProps } from 'antd';
import type { MaterialComponentProps } from '@tangramino/base-editor';

interface IProps extends RadioProps, MaterialComponentProps {
  label?: string;
  optionDisplayButton?: boolean;
}

export const Radio = (props: IProps) => {
  const { label, optionDisplayButton, tg_setContextValues, ...rest } = props;

  if (optionDisplayButton) {
    return (
      <AntdRadio.Group
        optionType='button'
        buttonStyle='solid'
        {...rest}
      >
        {label}
      </AntdRadio.Group>
    );
  }

  return (
    <AntdRadio.Group {...rest}>
      {label}
    </AntdRadio.Group>
  );
};

export default Radio;
