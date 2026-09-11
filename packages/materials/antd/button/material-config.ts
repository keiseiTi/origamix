import { lazy } from 'react';
import type { Material } from '@/material';
import { buttonManifest } from './manifest';

const ButtonMaterial: Material = {
  Component: lazy(() => import('./index')),
  title: buttonManifest.title,
  type: buttonManifest.type,
  defaultProps: buttonManifest.defaultProps,
  contextConfig: {
    variables: [...buttonManifest.context.variables],
    methods: buttonManifest.context.methods.map((method) => ({
      ...method,
      params: method.params?.map((param) => ({ description: param.description ?? '' })),
    })),
  },
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '按钮文本',
            field: 'text',
            uiType: 'input',
            props: {
              placeholder: '请输入按钮文本',
            },
          },
          {
            label: '按钮类型',
            field: 'type',
            uiType: 'select',
            props: {
              allowClear: true,
              options: [
                { label: '默认', value: 'default' },
                { label: '主要', value: 'primary' },
                { label: '虚线', value: 'dashed' },
                { label: '链接', value: 'link' },
                { label: '文本', value: 'text' },
              ],
            },
          },
          {
            label: '按钮形状',
            field: 'shape',
            uiType: 'select',
            props: {
              allowClear: true,
              options: [
                { label: '圆形', value: 'circle' },
                { label: '圆角', value: 'round' },
              ],
            },
          },
          {
            label: '跳转的地址',
            field: 'href',
            uiType: 'input',
          },
          {
            label: '跳转的目标',
            field: 'target',
            uiType: 'select',
            props: {
              allowClear: true,
              options: [
                { label: '当前窗口', value: '_self' },
                { label: '新窗口', value: '_blank' },
              ],
            },
            linkageShow: [
              {
                field: 'href',
                isNotEmpty: true,
              },
            ],
          },
          {
            label: '按钮背景透明',
            field: 'ghost',
            uiType: 'checkbox',
          },
        ],
      },
    ],
  },
};

export default ButtonMaterial;
