import React from 'react';
import { InputNumber as AntdInputNumber, type InputNumberProps } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';

export type IProps = InputNumberProps & MaterialComponentProps;

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
    tg_setRuntimeState,
    tg_setContextValues,
    ...rest
  } = props;
  const [current, change] = useRuntimeValue(
    'value',
    value,
    defaultValue ?? null,
    tg_setRuntimeState,
  );
  return (
    <AntdInputNumber
      {...rest}
      value={current}
      onChange={(next) => {
        const numeric = next === null ? null : globalThis.Number(next);
        change(numeric);
        onChange?.(numeric);
      }}
      onPressEnter={(event) => {
        if (!event.nativeEvent.isComposing) {
          const text = (event.target as HTMLInputElement).value;
          const next =
            text.trim() === ''
              ? null
              : globalThis.Number(text.replace(rest.decimalSeparator ?? '.', '.'));
          if (next === null || globalThis.Number.isFinite(next)) change(next);
          onPressEnter?.(event);
        }
      }}
    />
  );
};
export default Number;
