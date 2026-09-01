import React from 'react';

const TimePicker = React.lazy(() => import('./index'));
import type { Material } from '../interfaces/material';

const TimePickerMaterial: Material = {
  Component: TimePicker,
  title: '时间选择器',
  type: 'timePicker',
  dropTypes: ['form'],
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
                  label: 'HH:mm:ss',
                  value: 'HH:mm:ss',
                },
                {
                  label: 'HH:mm',
                  value: 'HH:mm',
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

export default TimePickerMaterial;
