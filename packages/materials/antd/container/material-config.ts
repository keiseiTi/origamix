import { containerLayoutConfigs } from '../container-layout-panel';
import { lazy } from 'react';
import { defineMaterial } from '@';
import { containerManifest } from './manifest';
const ContainerMaterial = defineMaterial({
  manifest: containerManifest,
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          ...containerLayoutConfigs,
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
            label: '高度（px）',
            field: 'height',
            uiType: 'number',
            linkageShow: [{ field: 'heightConfig', value: 'fixed' }],
          },
        ],
      },
    ],
  },
});
export default ContainerMaterial;
