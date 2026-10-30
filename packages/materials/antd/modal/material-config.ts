import { lazy } from 'react';
import { defineMaterial } from '@';
import { modalManifest } from './manifest';
const material = defineMaterial({
  manifest: modalManifest,
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            field: 'open',
            label: '显示弹窗',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'width',
            label: '宽度',
            uiType: 'number',
            props: {
              min: 1,
            },
          },
          {
            field: 'centered',
            label: '居中显示',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'closable',
            label: '显示关闭按钮',
            uiType: 'checkbox',
            defaultValue: true,
          },
          {
            field: 'mask',
            label: '显示遮罩',
            uiType: 'checkbox',
            defaultValue: true,
          },
          {
            field: 'maskClosable',
            label: '点击遮罩关闭',
            uiType: 'checkbox',
            defaultValue: true,
            linkageShow: [
              {
                field: 'mask',
                value: true,
              },
            ],
          },
          {
            field: 'keyboard',
            label: 'Esc 关闭',
            uiType: 'checkbox',
            defaultValue: true,
          },
          {
            field: 'loading',
            label: '内容加载中',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'showFooter',
            label: '显示底部按钮',
            uiType: 'checkbox',
            defaultValue: true,
          },
          {
            field: 'okType',
            label: '确定按钮类型',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '主要',
                  value: 'primary',
                },
                {
                  label: '默认',
                  value: 'default',
                },
                {
                  label: '虚线',
                  value: 'dashed',
                },
                {
                  label: '文本',
                  value: 'text',
                },
                {
                  label: '链接',
                  value: 'link',
                },
              ],
            },
            linkageShow: [
              {
                field: 'showFooter',
                value: true,
              },
            ],
          },
          {
            field: 'confirmLoading',
            label: '确定按钮加载中',
            uiType: 'checkbox',
            defaultValue: false,
            linkageShow: [
              {
                field: 'showFooter',
                value: true,
              },
            ],
          },
          {
            field: 'okDisabled',
            label: '禁用确定按钮',
            uiType: 'checkbox',
            defaultValue: false,
            linkageShow: [
              {
                field: 'showFooter',
                value: true,
              },
            ],
          },
          {
            field: 'cancelDisabled',
            label: '禁用取消按钮',
            uiType: 'checkbox',
            defaultValue: false,
            linkageShow: [
              {
                field: 'showFooter',
                value: true,
              },
            ],
          },
          {
            field: 'forceRender',
            label: '预先渲染内容',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'destroyOnHidden',
            label: '关闭后销毁内容',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'zIndex',
            label: '浮层层级',
            uiType: 'number',
            props: {
              min: 0,
              step: 1,
            },
          },
        ],
      },
    ],
  },
});
export default material;
