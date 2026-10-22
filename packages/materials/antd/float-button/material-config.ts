import { lazy } from 'react';
import { defineMaterial } from '@';
import { floatButtonManifest } from './manifest';
const FloatButtonMaterial = defineMaterial({
  manifest: floatButtonManifest,
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '按钮类型',
            field: 'type',
            uiType: 'select',
            props: {
              options: [
                { label: '默认', value: 'default' },
                { label: '主要', value: 'primary' },
              ],
            },
          },
          {
            label: '按钮形状',
            field: 'shape',
            uiType: 'radio',
            props: {
              options: [
                { label: '圆形', value: 'circle' },
                { label: '方形', value: 'square' },
              ],
            },
          },
          {
            label: '禁用',
            field: 'disabled',
            uiType: 'checkbox',
          },
        ],
      },
    ],
  },
});
export default FloatButtonMaterial;
