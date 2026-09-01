import React, { useEffect, useState } from 'react';
import { Input as AntdInput } from 'antd';
import type { MaterialComponentProps } from '@tangramino/base-editor';

export type IProps = MaterialComponentProps & {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
};

export const Textarea = (props: IProps) => {
  const { onChange, value, tg_setContextValues, ...restProps } = props;
  const [innerValue, setInnerValue] = useState<string>();

  useEffect(() => {
    setInnerValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInnerValue(e.target.value);
    onChange?.(e);
  };

  return <AntdInput.TextArea value={innerValue} onChange={handleChange} {...restProps} />;
};

export default Textarea;
