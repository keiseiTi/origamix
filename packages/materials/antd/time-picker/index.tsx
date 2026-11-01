import type { MaterialEventProps } from '../../src/runtime-material';
import { TimePicker as AntdTimePicker, type TimePickerProps } from 'antd';
import type { RuntimeMaterialProps } from '@';
import { parseTimeValue, serializeTimeValue } from '../date-value';
import { useRuntimeValue } from '../runtime-state';
export type IProps = MaterialEventProps<
  Omit<TimePickerProps, 'value' | 'defaultValue'>,
  'onChange' | 'onOk'
> &
  RuntimeMaterialProps & { value?: string | null; defaultValue?: string };
export const TimePicker = (props: IProps) => {
  const {
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
  } = props;

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
      onChange={(time) => {
        const next = serializeTimeValue(time);
        change(next);
        onChange?.({ value: next });
      }}
      onOk={(time) => {
        const next = serializeTimeValue(time);
        change(next);
        onOk?.({ value: next });
      }}
    />
  );
};
export default TimePicker;
