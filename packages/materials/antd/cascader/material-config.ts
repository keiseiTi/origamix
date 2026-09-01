import { lazy } from 'react';
import type { Material } from '../interfaces/material';

const CascaderMaterial: Material = {
  Component: lazy(() => import('./index')),
  title: '级联选择',
  type: 'cascader',
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
        name: 'options',
        description: '选项',
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

export default CascaderMaterial;
