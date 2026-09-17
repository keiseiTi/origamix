// import { OptionsConfig } from '@/components/options-config';
import { lazy } from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { radioManifest } from './manifest';

const RadioMaterial = toEditorMaterial(
  fromMaterialManifest(radioManifest, {
    editorConfig: {
      panels: [
        {
          title: '属性',
          configs: [
            {
              label: '选项是否用按钮展示',
              field: 'optionDisplayButton',
              uiType: 'checkbox',
            },
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

export default RadioMaterial;
