import React from 'react';
import type { RuntimeMaterialProps } from '@';
import { Cascader as AntdCascader, type CascaderProps } from 'antd';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IProps = CascaderProps<any> & RuntimeMaterialProps;

import { useRuntimeValue } from '../runtime-state';
export const Cascader = (props: IProps) => {
  const {
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
  const [current, change] = useRuntimeValue('value', value, defaultValue ?? [], tg_setRuntimeState);
  return (
    <AntdCascader
      {...rest}
      value={current}
      onChange={(...args) => {
        change(args[0] ?? []);
        onChange?.(...args);
      }}
    />
  );
};
export default Cascader;
