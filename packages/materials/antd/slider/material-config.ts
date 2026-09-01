import { lazy } from 'react';
import type { Material } from '../interfaces/material';

const TimePickerMaterial: Material = {
  Component: lazy(() => import('./index')),
  title: '滑动输入条',
  type: 'timePicker',
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
            label: '最大值',
            field: 'max',
            uiType: 'number',
          },
          {
            label: '最小值',
            field: 'min',
            uiType: 'number',
          },
        ],
      },
    ],
  },
};

export default TimePickerMaterial;
