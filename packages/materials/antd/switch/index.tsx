import React, { useEffect, useState } from 'react';
import { Switch as AntdSwitch, type SwitchProps } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';

export type IProps = SwitchProps & MaterialComponentProps & {};

export const Switch = (props: IProps) => {
  const { checked, defaultChecked, onChange, tg_setContextValues, ...restProps } = props;
  const [innerChecked, setInnerChecked] = useState(checked ?? defaultChecked ?? false);
  useEffect(() => {
    setInnerChecked(checked ?? defaultChecked ?? false);
  }, [checked, defaultChecked]);
  const handleChange: NonNullable<SwitchProps['onChange']> = (next, event) => {
    setInnerChecked(next);
    onChange?.(next, event);
  };
  return <AntdSwitch {...restProps} checked={innerChecked} onChange={handleChange} />;
};

export default Switch;
