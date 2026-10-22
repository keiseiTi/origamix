import React from 'react';
import { Radio as AntdRadio, type RadioGroupProps } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';

export interface IProps extends RadioGroupProps, MaterialComponentProps {
  label?: string;
}

import { useRuntimeValue } from '../runtime-state';
export const Radio = (props: IProps) => {
  const {
    label,
    value,
    defaultValue,
    onChange,
    fieldName,
    fieldRequired,
    fieldLabel,
    tg_setRuntimeState,
    tg_setContextValues,
    ...rest
  } = props;
  const [current, change] = useRuntimeValue(
    'value',
    value,
    defaultValue ?? null,
    tg_setRuntimeState,
  );
  return (
    <AntdRadio.Group
      {...rest}
      value={current}
      onChange={(event) => {
        change(event.target.value);
        onChange?.(event);
      }}
    />
  );
};
export default Radio;
