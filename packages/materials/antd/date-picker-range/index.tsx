import React from 'react';
import { DatePicker as AntdDatePicker } from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker';
import type { RuntimeMaterialProps } from '../../src/runtime-material';
import { parseDateValue } from '../date-value';

export type IProps = Omit<RangePickerProps, 'placeholder' | 'minDate' | 'maxDate'> &
  RuntimeMaterialProps & {
    placeholder?: [string, string];
    startPlaceholder?: string;
    endPlaceholder?: string;
    defaultStart?: string;
    defaultEnd?: string;
    allowEmptyStart?: boolean;
    allowEmptyEnd?: boolean;
    minDate?: string;
    maxDate?: string;
  };
export const DatePickerRange = ({
  placeholder,
  startPlaceholder,
  endPlaceholder,
  defaultStart,
  defaultEnd,
  defaultValue,
  allowEmptyStart,
  allowEmptyEnd,
  allowEmpty,
  minDate,
  maxDate,
  tg_setContextValues,
  ...rest
}: IProps) => {
  const placeholders = placeholder ?? ['开始日期', '结束日期'];
  return (
    <AntdDatePicker.RangePicker
      key={`${defaultStart}:${defaultEnd}`}
      {...rest}
      placeholder={[startPlaceholder ?? placeholders[0], endPlaceholder ?? placeholders[1]]}
      defaultValue={
        defaultStart || defaultEnd
          ? [parseDateValue(defaultStart) ?? null, parseDateValue(defaultEnd) ?? null]
          : defaultValue
      }
      allowEmpty={
        allowEmptyStart !== undefined || allowEmptyEnd !== undefined
          ? [Boolean(allowEmptyStart), Boolean(allowEmptyEnd)]
          : allowEmpty
      }
      minDate={parseDateValue(minDate)}
      maxDate={parseDateValue(maxDate)}
    />
  );
};
export default DatePickerRange;
