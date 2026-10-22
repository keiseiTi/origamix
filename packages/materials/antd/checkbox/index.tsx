import React from 'react';
import { Checkbox as AntdCheckbox } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '@';

type AntdCheckboxGroupProps = React.ComponentProps<typeof AntdCheckbox.Group>;
export interface IProps extends AntdCheckboxGroupProps, MaterialComponentProps {
  label?: string;
}

import { useRuntimeValue } from '../runtime-state';
export const Checkbox = (props: IProps) => {
  const {
    label,
    value,
    defaultValue,
    onChange,
    fieldName,
    fieldRequired,
    fieldLabel,
    tg_setRuntimeState,
    tg_setContextValues,
    ...rest
  } = props;
  const [current, change] = useRuntimeValue('value', value, defaultValue ?? [], tg_setRuntimeState);
  return (
    <AntdCheckbox.Group
      {...rest}
      value={current}
      onChange={(...args) => {
        change(args[0]);
        onChange?.(...args);
      }}
    />
  );
};
export default Checkbox;
