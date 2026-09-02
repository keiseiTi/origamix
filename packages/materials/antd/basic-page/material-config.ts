import { lazy } from 'react';
import type { Material } from '../../src/material';

const BasicPageMaterial: Material = {
  title: '页面',
  type: 'basicPage',
  isContainer: true,
  Component: lazy(() => import('./index')),
  defaultProps: {
    display: 'flow',
    flexDirection: 'column',
  },
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
};

export default BasicPageMaterial;
