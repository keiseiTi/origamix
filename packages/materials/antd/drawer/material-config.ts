import { lazy } from 'react';
import { defineMaterial } from '@';
import { drawerManifest } from './manifest';

const material = defineMaterial({
  manifest: drawerManifest,
  Component: lazy(() => import('./index')),
  isContainer: true,
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            field: 'title',
            label: '标题',
            uiType: 'input',
          },
          {
            field: 'open',
            label: '显示抽屉',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'placement',
            label: '位置',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '左侧',
                  value: 'left',
                },
                {
                  label: '右侧',
                  value: 'right',
                },
                {
                  label: '顶部',
                  value: 'top',
                },
                {
                  label: '底部',
                  value: 'bottom',
                },
              ],
            },
          },
          {
            field: 'size',
            label: '预设尺寸',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '默认',
                  value: 'default',
                },
                {
                  label: '大',
                  value: 'large',
                },
              ],
            },
          },
          {
            field: 'customSize',
            label: '自定义尺寸（覆盖预设）',
            uiType: 'number',
            props: {
              min: 1,
            },
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
            field: 'extra',
            label: '标题右侧文本',
            uiType: 'input',
          },
          {
            field: 'footer',
            label: '底部文本',
            uiType: 'input',
          },
          {
            field: 'resizable',
            label: '允许调整尺寸',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'push',
            label: '嵌套抽屉推开父层',
            uiType: 'checkbox',
            defaultValue: true,
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
