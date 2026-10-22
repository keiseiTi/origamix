import { TimePicker as AntdTimePicker, type TimePickerProps } from 'antd';
import type { RuntimeMaterialProps } from '@';
import { parseTimeValue, serializeTimeValue } from '../date-value';
import { useRuntimeValue } from '../runtime-state';
export type IProps = Omit<TimePickerProps, 'value' | 'defaultValue'> &
  RuntimeMaterialProps & { value?: string | null; defaultValue?: string };
export const TimePicker = ({
  value,
  defaultValue,
  onChange,
  onOk,
  fieldName,
  fieldLabel,
  tg_setRuntimeState,
  tg_setContextValues,
  ...rest
}: IProps) => {
  const [current, change] = useRuntimeValue(
    'value',
    value,
    serializeTimeValue(defaultValue),
    tg_setRuntimeState,
  );
  return (
    <AntdTimePicker
      {...rest}
      value={parseTimeValue(current) ?? null}
      onChange={(...args) => {
        change(serializeTimeValue(args[0]));
        onChange?.(...args);
      }}
      onOk={(time) => {
        change(serializeTimeValue(time));
        onOk?.(time);
      }}
    />
  );
};
export default TimePicker;
