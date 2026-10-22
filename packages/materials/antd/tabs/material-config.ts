import { TabItemsEditor } from '../../components/structured-editors';
import { lazy } from 'react';
import { defineMaterial } from '@';
import { tabsManifest } from './manifest';
const material = defineMaterial({
  manifest: tabsManifest,
  Component: lazy(() => import('./index')),
  isContainer: true,
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            field: 'items',
            label: '页签项',
            uiType: 'custom',
            render: TabItemsEditor,
          },
          {
            field: 'defaultActiveKey',
            label: '默认激活键',
            uiType: 'input',
          },
          {
            field: 'type',
            label: '类型',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '线条',
                  value: 'line',
                },
                {
                  label: '卡片',
                  value: 'card',
                },
                {
                  label: '可编辑卡片',
                  value: 'editable-card',
                },
              ],
            },
          },
          {
            field: 'size',
            label: '尺寸',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '大',
                  value: 'large',
                },
                {
                  label: '中',
                  value: 'medium',
                },
                {
                  label: '小',
                  value: 'small',
                },
              ],
            },
          },
          {
            field: 'tabPlacement',
            label: '位置',
            uiType: 'select',
            defaultValue: 'top',
            props: {
              options: [
                {
                  label: '顶部',
                  value: 'top',
                },
                {
                  label: '右侧',
                  value: 'end',
                },
                {
                  label: '底部',
                  value: 'bottom',
                },
                {
                  label: '左侧',
                  value: 'start',
                },
              ],
            },
          },
          {
            field: 'tabBarGutter',
            label: '页签间距',
            uiType: 'number',
            props: {
              min: 0,
            },
          },
          {
            field: 'centered',
            label: '居中',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'animated',
            label: '切换动画',
            uiType: 'checkbox',
            defaultValue: true,
          },
          {
            field: 'destroyOnHidden',
            label: '销毁隐藏面板',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'hideAdd',
            label: '隐藏新增按钮',
            uiType: 'checkbox',
            defaultValue: true,
            linkageShow: [
              {
                field: 'type',
                value: 'editable-card',
              },
            ],
          },
        ],
      },
    ],
  },
});
export default material;
