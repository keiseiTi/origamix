import React from 'react';
import { TimePicker as AntdTimePicker, type TimePickerProps } from 'antd';
import type { Dayjs } from 'dayjs';
import type { RuntimeMaterialProps } from '../../src/runtime-material';
import { parseTimeValue } from '../date-value';

export type IProps = Omit<TimePickerProps, 'value' | 'defaultValue'> &
  RuntimeMaterialProps & {
    value?: Dayjs | string | null;
    defaultValue?: Dayjs | string;
  };
export const TimePicker = ({ value, defaultValue, tg_setContextValues, ...rest }: IProps) => (
  <AntdTimePicker
    key={String(defaultValue ?? '')}
    {...rest}
    value={value === undefined ? undefined : (parseTimeValue(value) ?? null)}
    defaultValue={parseTimeValue(defaultValue)}
  />
);
export default TimePicker;
