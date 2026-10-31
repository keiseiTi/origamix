import React from 'react';
import { Select as AntdSelect, type SelectProps } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';

export type IProps = SelectProps & MaterialComponentProps & {};

import { useRuntimeValue } from '../runtime-state';
export const Select = (props: IProps) => {
  const {
    value,
    defaultValue,
    onChange,
    fieldName,
    fieldRequired,
    fieldLabel,
    om_setRuntimeState,
    om_mode,
    om_readonly,
    om_dropPlaceholder,
    om_setContextActions,
    ...rest
  } = props;
  const [current, change] = useRuntimeValue(
    'value',
    value,
    (defaultValue ?? props.mode) ? [] : null,
    om_setRuntimeState,
  );
  return (
    <AntdSelect
      {...rest}
      value={current}
      onChange={(...args) => {
        change(args[0] ?? (props.mode ? [] : null));
        onChange?.(...args);
      }}
    />
  );
};
export default Select;
