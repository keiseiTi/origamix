import React from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { switchManifest } from './manifest';

const Switch = React.lazy(() => import('./index'));

const SwitchMaterial = toEditorMaterial(
  fromMaterialManifest(switchManifest, {
    editorConfig: {
      panels: [
        {
          title: '属性',
          configs: [
            {
              label: '初始是否选中',
              field: 'defaultChecked',
              uiType: 'checkbox',
            },
          ],
        },
      ],
    },
  }),
  Switch,
);

export default SwitchMaterial;
