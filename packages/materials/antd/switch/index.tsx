import React from 'react';
import { Switch as AntdSwitch, type SwitchProps } from 'antd';
import type { MaterialComponentProps } from '@tangramino/base-editor';

export type IProps = SwitchProps & MaterialComponentProps & {};

export const Switch = (props: IProps) => {
  const { tg_setContextValues, ...restProps } = props;
  return <AntdSwitch {...restProps} />;
};

export default Switch;
