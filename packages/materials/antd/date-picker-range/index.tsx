import React from 'react';
import { DatePicker as AntdDatePicker } from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker';
import type { RuntimeMaterialProps as MaterialComponentProps } from '../../src/runtime-material';

export interface IProps extends RangePickerProps, MaterialComponentProps {}

export const DatePickerRange = (props: IProps) => {
  const { tg_setContextValues, ...restProps } = props;
  return <AntdDatePicker.RangePicker {...restProps} />;
};

export default DatePickerRange;
