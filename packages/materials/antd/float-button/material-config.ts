import { lazy } from 'react';
import type { Material } from '@/material';

const FloatButtonMaterial: Material = {
  Component: lazy(() => import('./index')),
  title: '悬浮按钮',
  type: 'floatButton',
  defaultProps: {
    type: 'default',
    shape: 'circle',
  },
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
            label: '位置',
            field: 'placement',
            uiType: 'select',
            props: {
              options: [
                { label: '右下', value: 'bottomRight' },
                { label: '左下', value: 'bottomLeft' },
                { label: '右上', value: 'topRight' },
                { label: '左上', value: 'topLeft' },
              ],
            },
          },
          {
            label: '描述',
            field: 'description',
            uiType: 'input',
            props: {
              placeholder: '请输入描述文本',
            },
          },
          {
            label: '工具提示',
            field: 'tooltip',
            uiType: 'input',
            props: {
              placeholder: '请输入工具提示文本',
            },
          },
          {
            label: '禁用',
            field: 'disabled',
            uiType: 'checkbox',
          },
          {
            label: '危险按钮',
            field: 'danger',
            uiType: 'checkbox',
          },
        ],
      },
    ],
  },
};

export default FloatButtonMaterial;
