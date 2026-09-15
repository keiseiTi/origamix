import { lazy } from 'react';
import type { Material } from '../../src/material';

const DatePickerMaterial: Material = {
  Component: lazy(() => import('./index')),
  title: '日期选择器',
  type: 'datePicker',
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
                  label: 'YYYY-MM-DD',
                  value: 'YYYY-MM-DD',
                },
                {
                  label: 'hh:mm:ss',
                  value: 'hh:mm:ss',
                },
              ],
            },
          },
          {
            label: '选择器类型',
            field: 'picker',
            uiType: 'select',
            props: {
              allowClear: true,
              options: [
                {
                  label: '日期',
                  value: 'date',
                },
                {
                  label: '周',
                  value: 'week',
                },
                {
                  label: '月',
                  value: 'month',
                },
                {
                  label: '季度',
                  value: 'quarter',
                },
                {
                  label: '年',
                  value: 'year',
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
