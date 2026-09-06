import { lazy } from 'react';
import type { Material } from '../../src/material';
import { formManifest } from '../manifest';

const FormMaterial: Material = {
  Component: lazy(() => import('./index')),
  title: formManifest.title,
  type: formManifest.type,
  isContainer: true,
  dropTypes: ['basicPage', 'container'],
  defaultProps: formManifest.defaultProps,
  contextConfig: {
    variables: [...formManifest.context.variables],
    contextValues: [...formManifest.context.values],
  },
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '布局',
            field: 'layout',
            uiType: 'radio',
            props: {
              options: [
                { label: '水平', value: 'horizontal' },
                { label: '垂直', value: 'vertical' },
                { label: '内联', value: 'inline' },
              ],
            },
          },
          {
            label: '表单项大小',
            field: 'size',
            uiType: 'radio',
            props: {
              options: [
                { label: '大', value: 'large' },
                { label: '中', value: 'middle' },
                { label: '小', value: 'small' },
              ],
            },
          },

          {
            label: '标签对齐',
            field: 'labelAlign',
            uiType: 'radio',
            props: {
              options: [
                { label: '左对齐', value: 'left' },
                { label: '右对齐', value: 'right' },
              ],
            },
          },
          {
            label: '标签布局占据空间',
            field: 'labelColVal',
            uiType: 'number',
          },
          {
            label: '控件布局占据空间',
            field: 'wrapperColVal',
            uiType: 'number',
          },
          {
            label: '滚动到第一个错误',
            field: 'scrollToFirstError',
            uiType: 'checkbox',
          },
        ],
      },
    ],
  },
};

export default FormMaterial;
