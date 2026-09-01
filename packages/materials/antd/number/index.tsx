import React, { useEffect, useState } from 'react';
import { InputNumber as AntdInputNumber, type InputNumberProps } from 'antd';
import type { MaterialComponentProps } from '@tangramino/base-editor';

export type IProps = InputNumberProps & MaterialComponentProps;

export const Number = (props: IProps) => {
  const { value, onChange, tg_setContextValues, ...restProps } = props;
  const [innerValue, setInnerValue] = useState<string | number | null>();

  useEffect(() => {
    setInnerValue(value);
  }, [value]);

  const handleChange = (v: string | number | null) => {
    setInnerValue(v);
    onChange?.(v);
  };

  return <AntdInputNumber value={innerValue} onChange={handleChange} {...restProps} />;
};

export default Number;
