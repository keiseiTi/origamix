import { lazy } from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { datePickerManifest } from './manifest';

const DatePickerMaterial = toEditorMaterial(
  fromMaterialManifest(datePickerManifest, {
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
  }),
  lazy(() => import('./index')),
);

export default DatePickerMaterial;
