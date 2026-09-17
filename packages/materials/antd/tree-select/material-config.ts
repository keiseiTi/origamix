import React from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { treeSelectManifest } from './manifest';

const TreeSelect = React.lazy(() => import('./index'));

const TreeSelectMaterial = toEditorMaterial(
  fromMaterialManifest(treeSelectManifest, {
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
  TreeSelect,
);

export default TreeSelectMaterial;
