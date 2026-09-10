import React from 'react';
import { TimePicker as AntdTimePicker, type TimePickerProps } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '../../src/runtime-material';

export type IProps = TimePickerProps & MaterialComponentProps & {};

export const TimePicker = (props: IProps) => {
  const { tg_setContextValues, ...restProps } = props;
  return <AntdTimePicker {...restProps} />;
};

export default TimePicker;
