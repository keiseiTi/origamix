import { lazy } from 'react';
import { defineMaterial } from '@';
import { checkboxManifest } from './manifest';

const material = defineMaterial({
  manifest: checkboxManifest,
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '禁用',
            field: 'disabled',
            uiType: 'checkbox',
          },
          {
            label: '表单字段名',
            field: 'name',
            uiType: 'input',
          },
        ],
      },
    ],
  },
});

export default material;
