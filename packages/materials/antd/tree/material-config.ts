import React from 'react';

const Tree = React.lazy(() => import('./index'));
import type { Material } from '../interfaces/material';

const TreeMaterial: Material = {
  Component: Tree,
  title: '树',
  type: 'tree',
  // isBlock: true,
  defaultProps: {
    treeData: [
      {
        title: '节点1',
        key: '0-0',
        children: [
          {
            title: '子节点1',
            key: '0-0-0',
          },
          {
            title: '子节点2',
            key: '0-0-1',
          },
        ],
      },
      {
        title: '节点2',
        key: '0-1',
      },
    ],
  },
  contextConfig: {
    variables: [
      {
        name: 'treeData',
        description: '树节点数据',
      },
      {
        name: 'selectedKeys',
        description: '选中节点键数组',
      },
      {
        name: 'checkedKeys',
        description: '勾选节点键数组',
      },
    ],
    methods: [
      {
        name: 'onSelect',
        description: '节点选中时触发的回调',
      },
      {
        name: 'onCheck',
        description: '节点勾选时触发的回调',
      },
    ],
  },
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '可选中',
            field: 'checkable',
            uiType: 'checkbox',
          },
          {
            label: '多选',
            field: 'multiple',
            uiType: 'checkbox',
          },
          {
            label: '默认展开所有',
            field: 'defaultExpandAll',
            uiType: 'checkbox',
          },
          {
            label: '严格选中',
            field: 'checkStrictly',
            uiType: 'checkbox',
          },
          {
            label: '显示线',
            field: 'showLine',
            uiType: 'checkbox',
          },
          {
            label: '可拖拽',
            field: 'draggable',
            uiType: 'checkbox',
          },
        ],
      },
    ],
  },
};

export default TreeMaterial;
