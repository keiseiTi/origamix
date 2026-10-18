import React from 'react';
import { DatePicker as AntdDatePicker, type DatePickerProps } from 'antd';
import type { Dayjs } from 'dayjs';
import type { RuntimeMaterialProps } from '@';
import { parseDateValue } from '../date-value';

export type IProps = Omit<DatePickerProps, 'value' | 'defaultValue' | 'minDate' | 'maxDate'> &
  RuntimeMaterialProps & {
    value?: Dayjs | string | null;
    defaultValue?: Dayjs | string;
    minDate?: Dayjs | string;
    maxDate?: Dayjs | string;
  };

export const DatePicker = ({
  value,
  defaultValue,
  minDate,
  maxDate,
  tg_setContextValues,
  ...rest
}: IProps) => (
  <AntdDatePicker
    key={String(defaultValue ?? '')}
    {...rest}
    value={value === undefined ? undefined : (parseDateValue(value) ?? null)}
    defaultValue={parseDateValue(defaultValue)}
    minDate={parseDateValue(minDate)}
    maxDate={parseDateValue(maxDate)}
  />
);
export default DatePicker;
