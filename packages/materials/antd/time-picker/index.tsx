import React from 'react';
import { TimePicker as AntdTimePicker, type TimePickerProps } from 'antd';
import type { MaterialComponentProps } from '@tangramino/base-editor';

export type IProps = TimePickerProps & MaterialComponentProps & {
};

export const TimePicker = (props: IProps) => {
  const { tg_setContextValues, ...restProps } = props;
  return (
    <AntdTimePicker
      {...restProps}
    />
  );
};

export default TimePicker;
