// import { OptionsConfig } from '@/components/options-config';
import { lazy } from 'react';
import type { Material } from '../../src/material';

const CheckboxMaterial: Material = {
  Component: lazy(() => import('./index')),
  title: '复选框',
  type: 'checkbox',
  dropTypes: ['form'],
  defaultProps: {
    options: [
      {
        label: '选项1',
        value: '选项1',
      },
      {
        label: '选项2',
        value: '选项2',
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
          // {
          //   field: 'options',
          //   uiType: 'custom',
          //   render: OptionsConfig,
          // },
        ],
      },
    ],
  },
};

export default CheckboxMaterial;
