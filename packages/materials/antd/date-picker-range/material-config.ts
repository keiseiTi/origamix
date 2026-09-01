import { lazy } from 'react';
import type { Material } from '../interfaces/material';

const DatePickerMaterial: Material = {
  Component: lazy(() => import('./index')),
  title: '日期范围选择器',
  type: 'datePickerRange',
  dropTypes: ['form'],
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
            label: '格式化',
            field: 'format',
            uiType: 'select',
            props: {
              allowClear: true,
              options: [
                {
                  label: 'YYYY-MM-DD HH:mm:ss',
                  value: 'YYYY-MM-DD HH:mm:ss',
                },
                {
                  label: 'YYYY-MM-DD HH:mm',
                  value: 'YYYY-MM-DD HH:mm',
                },
              ],
            },
          },
          {
            label: '占位符',
            field: 'placeholder',
            uiType: 'input',
          },
          {
            label: '是否显示此刻',
            field: 'showNow',
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

export default DatePickerMaterial;
