import React from 'react';

const Tabs = React.lazy(() => import('./index'));
import type { Material } from '@/material';

const TabsMaterial: Material = {
  Component: Tabs,
  title: '标签选型卡',
  type: 'tabs',
  isContainer: true,
  dropTypes: ['basicPage'],
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '激活键',
            field: 'activeKey',
            uiType: 'input',
          },
          {
            label: '默认激活键',
            field: 'defaultActiveKey',
            uiType: 'input',
          },
          {
            label: '类型',
            field: 'type',
            uiType: 'radio',
            props: {
              options: [
                { label: '线条', value: 'line' },
                { label: '卡片', value: 'card' },
                { label: '可编辑卡片', value: 'editable-card' },
              ],
            },
          },
          {
            label: '大小',
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
            label: '位置',
            field: 'tabPosition',
            uiType: 'select',
            props: {
              options: [
                { label: '顶部', value: 'top' },
                { label: '右侧', value: 'right' },
                { label: '底部', value: 'bottom' },
                { label: '左侧', value: 'left' },
              ],
            },
          },
          {
            label: '居中',
            field: 'centered',
            uiType: 'checkbox',
          },
          {
            label: '销毁隐藏面板',
            field: 'destroyInactiveTabPane',
            uiType: 'checkbox',
          },
          {
            label: '页签项(items)',
            field: 'items',
            uiType: 'input',
          },
        ],
      },
    ],
  },
};

export default TabsMaterial;
