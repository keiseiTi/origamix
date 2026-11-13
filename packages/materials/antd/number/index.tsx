import type { MaterialEventProps } from '../../src/runtime-material';
import { InputNumber as AntdInputNumber, type InputNumberProps } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';

export type IProps = MaterialEventProps<InputNumberProps, 'onChange' | 'onPressEnter'> &
  MaterialComponentProps;

import { useRuntimeValue } from '../runtime-state';
export const Number = (props: IProps) => {
  const {
    value,
    defaultValue,
    onChange,
    onPressEnter,
    fieldName,
    fieldRequired,
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
    defaultValue ?? null,
    om_setRuntimeState,
  );
  return (
    <AntdInputNumber
      {...rest}
      value={current}
      onChange={(next) => {
        const numeric = next === null ? null : globalThis.Number(next);
        change(numeric);
        onChange?.({ value: numeric });
      }}
      onPressEnter={(event) => {
        if (!event.nativeEvent.isComposing) {
          const text = (event.target as HTMLInputElement).value;
          const next =
            text.trim() === ''
              ? null
              : globalThis.Number(text.replace(rest.decimalSeparator ?? '.', '.'));
          if (next === null || globalThis.Number.isFinite(next)) change(next);
          onPressEnter?.({
            value: next === null || globalThis.Number.isFinite(next) ? next : current,
            key: 'Enter',
          });
        }
      }}
    />
  );
};
export default Number;
