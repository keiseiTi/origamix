import { lazy } from 'react';
import { defineMaterial } from '@';
import { basicPageManifest } from './manifest';
const BasicPageMaterial = defineMaterial({
  manifest: basicPageManifest,
  isContainer: true,
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '布局方式',
            field: 'display',
            uiType: 'select',
            props: {
              options: [
                { label: '流式布局', value: 'flow' },
                { label: '弹性布局', value: 'flex' },
              ],
            },
          },
          {
            label: '布局方向',
            field: 'flexDirection',
            uiType: 'select',
            defaultValue: 'column',
            props: {
              options: [
                { label: '垂直', value: 'column' },
                { label: '水平', value: 'row' },
              ],
            },
            linkageShow: [
              {
                field: 'display',
                value: 'flex',
              },
            ],
          },
        ],
      },
    ],
  },
});
export default BasicPageMaterial;
