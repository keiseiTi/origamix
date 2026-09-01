import React from 'react';
import { TreeSelect as AntdTreeSelect, type TreeSelectProps } from 'antd';

export type IProps = TreeSelectProps & {
};

export const TreeSelect = (props: IProps) => {
  const { ...restProps } = props;
  return (
    <AntdTreeSelect
      {...restProps}
    />
  );
};

export default TreeSelect;
