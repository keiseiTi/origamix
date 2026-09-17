// import { OptionsConfig } from '@/components/options-config';
import { lazy } from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { checkboxManifest } from './manifest';

const CheckboxMaterial = toEditorMaterial(
  fromMaterialManifest(checkboxManifest, {
    editorConfig: {
      panels: [
        {
          title: '属性',
          configs: [
            // {
            //   field: 'options',
            //   uiType: 'custom',
            //   render: OptionsConfig,
            // },
          ],
        },
      ],
    },
  }),
  lazy(() => import('./index')),
);

export default CheckboxMaterial;
