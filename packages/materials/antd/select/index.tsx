import React from 'react';
import { Select as AntdSelect, type SelectProps } from 'antd';
import type { MaterialComponentProps } from '@tangramino/base-editor';

export type IProps = SelectProps & MaterialComponentProps & {

};

export const Select = (props: IProps) => {
  const {
    tg_setContextValues,
    ...restProps
  } = props;

  return (
    <AntdSelect
      {...restProps}
    />
  );
};

export default Select;
