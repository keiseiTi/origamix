import { lazy } from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { sliderManifest } from './manifest';

const SliderMaterial = toEditorMaterial(
  fromMaterialManifest(sliderManifest, {
    editorConfig: {
      panels: [
        {
          title: '属性',
          configs: [
            {
              label: '最大值',
              field: 'max',
              uiType: 'number',
            },
            {
              label: '最小值',
              field: 'min',
              uiType: 'number',
            },
          ],
        },
      ],
    },
  }),
  lazy(() => import('./index')),
);

export default SliderMaterial;
