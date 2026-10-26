import React from 'react';
import { Input as AntdInput, type InputProps } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';

export type IProps = InputProps &
  MaterialComponentProps & {
    value?: string;
  };

import { useRuntimeValue } from '../runtime-state';
export const Input = (props: IProps) => {
  const {
    onChange,
    onPressEnter,
    value,
    defaultValue,
    fieldName,
    fieldRequired,
    fieldLabel,
    om_setRuntimeState,
    om_mode,
    om_readonly,
    om_dropPlaceholder,
    om_setContextValues,
    ...rest
  } = props;
  const [current, change] = useRuntimeValue('value', value, defaultValue ?? '', om_setRuntimeState);
  return (
    <AntdInput
      {...rest}
      value={current}
      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
        change(event.target.value);
        onChange?.(event);
      }}
      onPressEnter={(event) => {
        change(event.currentTarget.value);
        if (!event.nativeEvent.isComposing) onPressEnter?.(event);
      }}
    />
  );
};
export default Input;
