import { lazy } from 'react';
import { defineMaterial } from '@';
import { buttonManifest } from './manifest';

const ButtonMaterial = defineMaterial({
  manifest: buttonManifest,
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '按钮文本',
            field: 'text',
            uiType: 'input',
          },
          {
            label: '按钮类型',
            field: 'type',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '默认',
                  value: 'default',
                },
                {
                  label: '主要',
                  value: 'primary',
                },
                {
                  label: '虚线',
                  value: 'dashed',
                },
                {
                  label: '链接',
                  value: 'link',
                },
                {
                  label: '文本',
                  value: 'text',
                },
              ],
            },
          },
          {
            label: '尺寸',
            field: 'size',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '大',
                  value: 'large',
                },
                {
                  label: '中',
                  value: 'middle',
                },
                {
                  label: '小',
                  value: 'small',
                },
              ],
            },
          },
          {
            label: '形状',
            field: 'shape',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '默认',
                  value: undefined,
                },
                {
                  label: '圆形',
                  value: 'circle',
                },
                {
                  label: '圆角',
                  value: 'round',
                },
              ],
            },
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
            label: '危险样式',
            field: 'danger',
            uiType: 'checkbox',
          },
          {
            label: '撑满宽度',
            field: 'block',
            uiType: 'checkbox',
          },
          {
            label: '透明背景',
            field: 'ghost',
            uiType: 'checkbox',
          },
          {
            label: '跳转地址',
            field: 'href',
            uiType: 'input',
          },
          {
            label: '打开方式',
            field: 'target',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '当前窗口',
                  value: '_self',
                },
                {
                  label: '新窗口',
                  value: '_blank',
                },
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
            label: '原生按钮类型',
            field: 'htmlType',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '普通按钮',
                  value: 'button',
                },
                {
                  label: '提交',
                  value: 'submit',
                },
                {
                  label: '重置',
                  value: 'reset',
                },
              ],
            },
          },
        ],
      },
    ],
  },
});

export default ButtonMaterial;
