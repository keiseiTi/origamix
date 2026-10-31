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
    serializeTimeValue(defaultValue),
    om_setRuntimeState,
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
