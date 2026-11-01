import type { MaterialEventProps } from '../../src/runtime-material';
import { DatePicker as AntdDatePicker, type DatePickerProps } from 'antd';
import type { RuntimeMaterialProps } from '@';
import { parseDateValue, serializeDateValue } from '../date-value';
import { useRuntimeValue } from '../runtime-state';
export type IProps = MaterialEventProps<
  Omit<DatePickerProps, 'value' | 'defaultValue' | 'minDate' | 'maxDate'>,
  'onChange' | 'onOk'
> &
  RuntimeMaterialProps & {
    value?: string | null;
    defaultValue?: string;
    minDate?: string;
    maxDate?: string;
  };
export const DatePicker = (props: IProps) => {
  const {
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
  } = props;

  const [current, change] = useRuntimeValue(
    'value',
    value,
    serializeDateValue(
      defaultValue,
      Boolean(props.showTime) && (!props.picker || props.picker === 'date'),
    ),
    om_setRuntimeState,
  );
  return (
    <AntdDatePicker
      {...rest}
      value={parseDateValue(current) ?? null}
      minDate={parseDateValue(minDate)}
      maxDate={parseDateValue(maxDate)}
      onChange={(date) => {
        const next = serializeDateValue(
          date,
          Boolean(rest.showTime) && (!rest.picker || rest.picker === 'date'),
        );
        change(next);
        onChange?.({ value: next });
      }}
      onOk={(date) => {
        const next = serializeDateValue(
          date,
          Boolean(rest.showTime) && (!rest.picker || rest.picker === 'date'),
        );
        change(next);
        onOk?.({ value: next });
      }}
    />
  );
};
export default DatePicker;
