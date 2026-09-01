import React from 'react';
import { Checkbox as AntdCheckbox } from 'antd';
import type { MaterialComponentProps } from '@tangramino/base-editor';

type AntdCheckboxGroupProps = React.ComponentProps<typeof AntdCheckbox.Group>;
interface IProps extends AntdCheckboxGroupProps, MaterialComponentProps {
  label?: string;
}

export const Checkbox = (props: IProps) => {
  const { label, tg_setContextValues, ...rest } = props;
  return <AntdCheckbox.Group {...rest}></AntdCheckbox.Group>;
};

export default Checkbox;
