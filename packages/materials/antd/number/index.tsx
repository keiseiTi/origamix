import React, { useEffect, useState } from 'react';
import { InputNumber as AntdInputNumber, type InputNumberProps } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '../../src/runtime-material';

export type IProps = InputNumberProps & MaterialComponentProps;

export const Number = (props: IProps) => {
  const { value, defaultValue, onChange, tg_setContextValues, ...restProps } = props;
  const [innerValue, setInnerValue] = useState<string | number | null | undefined>(
    value ?? defaultValue,
  );

  useEffect(() => {
    setInnerValue(value ?? defaultValue);
  }, [value, defaultValue]);

  const handleChange = (v: string | number | null) => {
    setInnerValue(v);
    onChange?.(v);
  };

  return <AntdInputNumber value={innerValue} onChange={handleChange} {...restProps} />;
};

export default Number;
