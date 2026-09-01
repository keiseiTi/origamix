import React from 'react';
import { Tree as AntdTree, type TreeProps } from 'antd';

export type IProps = TreeProps & {
};

export const Tree = (props: IProps) => {
  const { ...restProps } = props;
  return (
    <AntdTree
      {...restProps}
    />
  );
};

export default Tree;
