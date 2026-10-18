import React, { useEffect, useState } from 'react';
import { Input as AntdInput } from 'antd';
import type { TextAreaProps } from 'antd/es/input/TextArea';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';

export type IProps = TextAreaProps &
  MaterialComponentProps & {
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  };

export const Textarea = (props: IProps) => {
  const { onChange, value, defaultValue, tg_setContextValues, ...restProps } = props;
  const [innerValue, setInnerValue] = useState(value ?? defaultValue);

  useEffect(() => {
    setInnerValue(value ?? defaultValue);
  }, [value, defaultValue]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInnerValue(e.target.value);
    onChange?.(e);
  };

  return <AntdInput.TextArea value={innerValue} onChange={handleChange} {...restProps} />;
};

export default Textarea;
