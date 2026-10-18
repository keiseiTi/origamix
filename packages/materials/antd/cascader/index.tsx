import React from 'react';
import type { RuntimeMaterialProps } from '@';
import { Cascader as AntdCascader, type CascaderProps } from 'antd';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IProps = CascaderProps<any> & RuntimeMaterialProps;

export const Cascader = (props: IProps) => {
  const { tg_setContextValues, ...restProps } = props;
  return <AntdCascader {...restProps} />;
};

export default Cascader;
