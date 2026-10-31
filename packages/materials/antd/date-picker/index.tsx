import { DatePicker as AntdDatePicker, type DatePickerProps } from 'antd';
import type { RuntimeMaterialProps } from '@';
import { parseDateValue, serializeDateValue } from '../date-value';
import { useRuntimeValue } from '../runtime-state';
export type IProps = Omit<DatePickerProps, 'value' | 'defaultValue' | 'minDate' | 'maxDate'> &
  RuntimeMaterialProps & {
    value?: string | null;
    defaultValue?: string;
    minDate?: string;
    maxDate?: string;
  };
export const DatePicker = ({
  value,
  defaultValue,
  minDate,
  maxDate,
  onChange,
  onOk,
  fieldName,
  fieldLabel,
  om_setRuntimeState,
  om_mode,
  om_readonly,
  om_dropPlaceholder,
  om_setContextActions,
  ...rest
}: IProps) => {
  const [current, change] = useRuntimeValue(
    'value',
    value,
    serializeDateValue(
      defaultValue,
      Boolean(rest.showTime) && (!rest.picker || rest.picker === 'date'),
    ),
    om_setRuntimeState,
  );
  return (
    <AntdDatePicker
      {...rest}
      value={parseDateValue(current) ?? null}
      minDate={parseDateValue(minDate)}
      maxDate={parseDateValue(maxDate)}
      onChange={(...args) => {
        change(
          serializeDateValue(
            args[0],
            Boolean(rest.showTime) && (!rest.picker || rest.picker === 'date'),
          ),
        );
        onChange?.(...args);
      }}
      onOk={(date) => {
        change(
          serializeDateValue(
            date,
            Boolean(rest.showTime) && (!rest.picker || rest.picker === 'date'),
          ),
        );
        onOk?.(date);
      }}
    />
  );
};
export default DatePicker;
