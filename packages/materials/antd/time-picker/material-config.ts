import React from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { timePickerManifest } from './manifest';

const TimePicker = React.lazy(() => import('./index'));

const TimePickerMaterial = toEditorMaterial(
  fromMaterialManifest(timePickerManifest, {
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
  }),
  TimePicker,
);

export default TimePickerMaterial;
