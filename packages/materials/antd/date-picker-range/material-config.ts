import { lazy } from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { datePickerRangeManifest } from './manifest';

const DatePickerMaterial = toEditorMaterial(
  fromMaterialManifest(datePickerRangeManifest, {
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
  }),
  lazy(() => import('./index')),
);

export default DatePickerMaterial;
