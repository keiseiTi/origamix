import React, { useEffect, useState } from 'react';
import { Input as AntdInput, type InputProps } from 'antd';
import type { MaterialComponentProps } from '@tangramino/base-editor';

export type IProps = InputProps &
  MaterialComponentProps & {
    value?: string;
  };

export const Input = (props: IProps) => {
  const { onChange, value, tg_setContextValues, ...restProps } = props;
  const [innerValue, setInnerValue] = useState<string>();

  useEffect(() => {
    setInnerValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInnerValue(e.target.value);
    onChange?.(e);
  };

  return <AntdInput value={innerValue} onChange={handleChange} {...restProps} />;
};

export default Input;
