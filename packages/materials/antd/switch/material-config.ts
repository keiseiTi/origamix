import { lazy } from 'react';
import { defineMaterial } from '@';
import { switchManifest } from './manifest';
const material = defineMaterial({
  manifest: switchManifest,
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '初始开启',
            field: 'defaultChecked',
            uiType: 'checkbox',
          },
          {
            label: '禁用',
            field: 'disabled',
            uiType: 'checkbox',
          },
          {
            label: '加载中',
            field: 'loading',
            uiType: 'checkbox',
          },
          {
            label: '尺寸',
            field: 'size',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '默认',
                  value: 'default',
                },
                {
                  label: '小',
                  value: 'small',
                },
              ],
            },
          },
        ],
      },
    ],
  },
});
export default material;
