import React from 'react';
import { Select as AntdSelect, type SelectProps } from 'antd';
import type { RuntimeMaterialProps as MaterialComponentProps } from '../../src/runtime-material';

export type IProps = SelectProps & MaterialComponentProps & {};

export const Select = (props: IProps) => {
  const { tg_setContextValues, ...restProps } = props;

  return <AntdSelect {...restProps} />;
};

export default Select;
