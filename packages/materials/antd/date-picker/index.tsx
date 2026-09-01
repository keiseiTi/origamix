import React from 'react';
import { DatePicker as AntdDatePicker, type DatePickerProps } from 'antd';
import type { MaterialComponentProps } from '@tangramino/base-editor';

export type IProps = DatePickerProps & MaterialComponentProps & {};

export const DatePicker = (props: IProps) => {
  const { tg_setContextValues, ...restProps } = props;
  return <AntdDatePicker {...restProps} />;
};

export default DatePicker;
