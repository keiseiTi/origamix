import type { MaterialEventProps } from '../../src/runtime-material';
import React from 'react';
import { Radio as AntdRadio, type RadioGroupProps } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';

export interface IProps
  extends MaterialEventProps<RadioGroupProps, 'onChange'>, MaterialComponentProps {
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
    defaultValue ?? null,
    om_setRuntimeState,
  );
  return (
    <AntdRadio.Group
      {...rest}
      value={current}
      onChange={(event) => {
        change(event.target.value);
        onChange?.({ value: event.target.value });
      }}
    />
  );
};
export default Radio;
