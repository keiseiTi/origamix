import React from 'react';
import type { RuntimeMaterialProps } from '@';
import { TreeSelect as AntdTreeSelect, type TreeSelectProps } from 'antd';

export type IProps = TreeSelectProps & RuntimeMaterialProps;

export const TreeSelect = (props: IProps) => {
  const { tg_setContextValues, ...restProps } = props;
  return <AntdTreeSelect {...restProps} />;
};

export default TreeSelect;
