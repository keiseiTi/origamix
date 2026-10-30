import { containerLayoutConfigs } from '../container-layout-panel';
import { lazy } from 'react';
import { defineMaterial } from '@';
import { basicPageManifest } from './manifest';
const BasicPageMaterial = defineMaterial({
  manifest: basicPageManifest,
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: containerLayoutConfigs,
      },
    ],
  },
});
export default BasicPageMaterial;
