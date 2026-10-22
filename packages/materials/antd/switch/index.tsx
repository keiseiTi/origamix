import React from 'react';
import { Switch as AntdSwitch, type SwitchProps } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';

export type IProps = SwitchProps & MaterialComponentProps & {};

import { useRuntimeValue } from '../runtime-state';
export const Switch = (props: IProps) => {
  const {
    checked,
    defaultChecked,
    onChange,
    fieldName,
    fieldRequired,
    fieldLabel,
    tg_setRuntimeState,
    tg_setContextValues,
    ...rest
  } = props;
  const [current, change] = useRuntimeValue(
    'checked',
    checked,
    defaultChecked ?? false,
    tg_setRuntimeState,
  );
  return (
    <AntdSwitch
      {...rest}
      checked={current}
      onChange={(...args) => {
        change(args[0]);
        onChange?.(...args);
      }}
    />
  );
};
export default Switch;
