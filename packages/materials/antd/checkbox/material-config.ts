import { OptionsEditor } from '../../components/collection-editor';
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
          { field: 'options', label: '选项配置', uiType: 'custom', render: OptionsEditor },
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
