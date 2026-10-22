import { DatePicker as AntdDatePicker } from 'antd';
import type { RangePickerProps } from 'antd/es/date-picker';
import type { RuntimeMaterialProps } from '@';
import { parseDateValue, serializeDateValue } from '../date-value';
import { useRuntimeValue } from '../runtime-state';
type Range = [string | null, string | null];
const EMPTY_RANGE: Range = [null, null];
export type IProps = Omit<
  RangePickerProps,
  'value' | 'defaultValue' | 'placeholder' | 'minDate' | 'maxDate'
> &
  RuntimeMaterialProps & {
    value?: Range;
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
  value,
  startPlaceholder,
  endPlaceholder,
  defaultStart,
  defaultEnd,
  allowEmptyStart,
  allowEmptyEnd,
  minDate,
  maxDate,
  onChange,
  onOk,
  fieldName,
  fieldLabel,
  tg_setRuntimeState,
  tg_setContextValues,
  ...rest
}: IProps) => {
  const [current, change] = useRuntimeValue<Range>(
    'value',
    value === undefined ? undefined : Array.isArray(value) ? value : EMPTY_RANGE,
    [
      serializeDateValue(
        defaultStart,
        Boolean(rest.showTime) && (!rest.picker || rest.picker === 'date'),
      ),
      serializeDateValue(
        defaultEnd,
        Boolean(rest.showTime) && (!rest.picker || rest.picker === 'date'),
      ),
    ],
    tg_setRuntimeState,
  );
  return (
    <AntdDatePicker.RangePicker
      {...rest}
      value={[parseDateValue(current[0]) ?? null, parseDateValue(current[1]) ?? null]}
      placeholder={[startPlaceholder ?? '开始日期', endPlaceholder ?? '结束日期']}
      allowEmpty={[Boolean(allowEmptyStart), Boolean(allowEmptyEnd)]}
      minDate={parseDateValue(minDate)}
      maxDate={parseDateValue(maxDate)}
      onChange={(...args) => {
        change([
          serializeDateValue(
            args[0]?.[0],
            Boolean(rest.showTime) && (!rest.picker || rest.picker === 'date'),
          ),
          serializeDateValue(
            args[0]?.[1],
            Boolean(rest.showTime) && (!rest.picker || rest.picker === 'date'),
          ),
        ]);
        onChange?.(...args);
      }}
      onOk={(dates) => {
        change([
          serializeDateValue(
            dates[0],
            Boolean(rest.showTime) && (!rest.picker || rest.picker === 'date'),
          ),
          serializeDateValue(
            dates[1],
            Boolean(rest.showTime) && (!rest.picker || rest.picker === 'date'),
          ),
        ]);
        onOk?.(dates);
      }}
    />
  );
};
export default DatePickerRange;
