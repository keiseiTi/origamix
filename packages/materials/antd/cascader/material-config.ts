import { lazy } from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { cascaderManifest } from './manifest';

const CascaderMaterial = toEditorMaterial(
  fromMaterialManifest(cascaderManifest, {
    editorConfig: {
      panels: [
        {
          title: '属性',
          configs: [
            {
              label: '占位符',
              field: 'placeholder',
              uiType: 'input',
            },
            {
              label: '多选',
              field: 'multiple',
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

export default CascaderMaterial;
