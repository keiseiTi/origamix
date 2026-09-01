import React from 'react';
import { DatePicker as AntdDatePicker } from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker';
import type { MaterialComponentProps } from '@tangramino/base-editor';

interface IProps extends RangePickerProps, MaterialComponentProps {}

export const DatePickerRange = (props: IProps) => {
  const { tg_setContextValues, ...restProps } = props;
  return <AntdDatePicker.RangePicker {...restProps} />;
};

export default DatePickerRange;
