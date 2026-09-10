import React from 'react';
import { Checkbox as AntdCheckbox } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '../../src/runtime-material';

type AntdCheckboxGroupProps = React.ComponentProps<typeof AntdCheckbox.Group>;
export interface IProps extends AntdCheckboxGroupProps, MaterialComponentProps {
  label?: string;
}

export const Checkbox = (props: IProps) => {
  const { label, tg_setContextValues, ...rest } = props;
  return <AntdCheckbox.Group {...rest}></AntdCheckbox.Group>;
};

export default Checkbox;
