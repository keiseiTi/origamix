import { lazy } from 'react';
import type { Material } from '../../src/material';

const ButtonMaterial: Material = {
  Component: lazy(() => import('./index')),
  title: '按钮',
  type: 'button',
  defaultProps: {
    text: '按钮',
    type: 'default',
    size: 'middle',
  },
  contextConfig: {
    variables: [
      {
        name: 'text',
        description: '按钮文本',
      },
      {
        name: 'disabled',
        description: '禁用按钮',
      },
      {
        name: 'loading',
        description: '按钮载入状态',
      },
    ],
    methods: [
      {
        name: 'onClick',
        description: '点击事件',
        params: [
          {
            description: '事件参数',
          },
        ],
      },
    ],
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
