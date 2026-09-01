import React from 'react';
import { Cascader as AntdCascader, type CascaderProps } from 'antd';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IProps = CascaderProps<any> & {};

export const Cascader = (props: IProps) => {
  const { ...restProps } = props;
  return <AntdCascader {...restProps} />;
};

export default Cascader;
