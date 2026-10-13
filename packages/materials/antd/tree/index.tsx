import React from 'react';
import { Tree as AntdTree, type TreeProps } from 'antd';
import type { RuntimeMaterialProps } from '../../src/runtime-material';

export type IProps = TreeProps & RuntimeMaterialProps;
export const Tree = ({ tg_setContextValues, tg_mode, ...rest }: IProps) => (
  <AntdTree
    key={
      tg_mode === 'design'
        ? JSON.stringify([
            rest.treeData,
            rest.defaultExpandAll,
            rest.defaultExpandParent,
            rest.defaultExpandedKeys,
            rest.defaultSelectedKeys,
            rest.defaultCheckedKeys,
          ])
        : undefined
    }
    {...rest}
  />
);
export default Tree;
