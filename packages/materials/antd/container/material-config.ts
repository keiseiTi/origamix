import { lazy } from 'react';
import { fromMaterialManifest, toEditorMaterial } from '../../src/origamix-material';
import { containerManifest } from './manifest';

const ContainerMaterial = toEditorMaterial(
  fromMaterialManifest(containerManifest, {
    editorConfig: {
      panels: [
        {
          title: '属性',
          configs: [],
        },
        {
          title: '样式',
          configs: [
            {
              label: '高度配置',
              field: 'heightConfig',
              uiType: 'select',
              defaultValue: 'fixed',
              props: {
                options: [
                  { label: '固定高度', value: 'fixed' },
                  { label: '自适应', value: 'auto' },
                ],
              },
            },
            {
              label: '高度',
              field: 'height',
              uiType: 'number',
              props: {
                suffix: 'px',
              },
              linkageShow: [{ field: 'heightConfig', value: 'fixed' }],
            },
            {
              label: '外边距',
              field: 'margin',
              uiType: 'number',
              props: {
                suffix: 'px',
              },
            },
            {
              label: '内边距',
              field: 'padding',
              uiType: 'number',
              props: {
                suffix: 'px',
              },
            },
          ],
        },
      ],
    },
    isContainer: true,
  }),
  lazy(() => import('./index')),
);

export default ContainerMaterial;
