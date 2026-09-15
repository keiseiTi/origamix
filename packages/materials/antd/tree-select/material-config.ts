import React from 'react';

const TreeSelect = React.lazy(() => import('./index'));
import type { Material } from '../../src/material';

const TreeSelectMaterial: Material = {
  Component: TreeSelect,
  title: '树选择器',
  type: 'treeSelect',
  dropTypes: ['form'],
  defaultProps: {
    options: [
      {
        label: '示例1',
        value: '示例1',
      },
    ],
  },
  contextConfig: {
    variables: [
      {
        name: 'value',
        description: '当前值',
      },
      {
        name: 'disabled',
        description: '是否禁用',
      },
      {
        name: 'treeData',
        description: '树节点数据',
      },
    ],
    methods: [
      {
        name: 'onChange',
        description: '值改变时的回调',
        params: [
          {
            description: '事件参数',
          },
        ],
      },
    ],
  },
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '占位符',
            field: 'placeholder',
            uiType: 'input',
          },
          {
            label: '多选',
            field: 'multiple',
            uiType: 'checkbox',
          },
          {
            label: '允许清除',
            field: 'allowClear',
            uiType: 'checkbox',
          },
        ],
      },
    ],
  },
};

export default TreeSelectMaterial;
