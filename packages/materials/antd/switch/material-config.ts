import React from 'react';

const Switch = React.lazy(() => import('./index'));
import type { Material } from '../../src/material';

const SwitchMaterial: Material = {
  Component: Switch,
  title: '开关',
  type: 'switch',
  dropTypes: ['form'],
  contextConfig: {
    variables: [
      {
        name: 'checked',
        description: '是否选中',
      },
      {
        name: 'disabled',
        description: '是否禁用',
      },
      {
        name: 'loading',
        description: '加载中的开关',
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
            label: '初始是否选中',
            field: 'defaultChecked',
            uiType: 'checkbox',
          },
        ],
      },
    ],
  },
};

export default SwitchMaterial;
