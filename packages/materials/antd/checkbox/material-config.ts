import { lazy } from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { checkboxManifest } from './manifest';

const material = toEditorMaterial(
  fromMaterialManifest(checkboxManifest, {
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
  }),
  lazy(() => import('./index')),
);

export default material;
