import { lazy } from 'react';
import { defineMaterial } from '@';

import { layoutDefaults } from './schema';
const LayoutMaterial = defineMaterial({
  type: 'Layout',
  title: '应用布局',
  role: 'layout',
  acceptsChildren: true,
  layout: { display: 'block' },
  defaultProps: layoutDefaults,
  description: '项目唯一布局根节点，通过属性统一管理顶部、侧栏、内容区和页脚。',
  keywords: ['Layout', '布局', '导航'],
  context: { variables: [], writable: [], actions: [], events: [] },
  usage:
    '只作为布局根节点。更新属性后自动调整内部区域，不手动新增、删除或移动内部区域。区域内容会保留，关闭区域仅隐藏。',
  constraints: ['必须有唯一 PageOutlet。内部 LayoutRegion 由布局配置管理。'],
  Component: lazy(() => import('./index').then((module) => ({ default: module.Layout }))),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            field: 'variant',
            label: '布局结构',
            uiType: 'select',
            props: {
              options: [
                { label: '上中下', value: 'top' },
                { label: '侧边布局', value: 'side' },
                { label: '顶部与侧边', value: 'top-side' },
                { label: '侧边与内容顶部', value: 'side-top' },
              ],
            },
          },
          {
            field: 'brand',
            label: '应用标题',
            uiType: 'input',
            schema: { type: 'string', maxLength: 120 },
          },
          { field: 'headerEnabled', label: '显示顶部', uiType: 'switch' },
          {
            field: 'headerHeight',
            label: '顶部高度',
            uiType: 'number',
            props: { min: 40, max: 200 },
          },
          { field: 'headerMenu', label: '顶部导航', uiType: 'switch' },
          { field: 'siderEnabled', label: '显示侧栏', uiType: 'switch' },
          {
            field: 'siderWidth',
            label: '侧栏宽度',
            uiType: 'number',
            props: { min: 120, max: 600 },
          },
          { field: 'siderMenu', label: '侧栏导航', uiType: 'switch' },
          { field: 'collapsible', label: '允许折叠', uiType: 'switch' },
          { field: 'defaultCollapsed', label: '默认折叠', uiType: 'switch' },
          {
            field: 'collapsedWidth',
            label: '折叠宽度',
            uiType: 'number',
            props: { min: 0, max: 120 },
          },
          {
            field: 'breakpoint',
            label: '响应式断点',
            uiType: 'select',
            props: {
              options: ['none', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl'].map((value) => ({
                label: value === 'none' ? '不自动折叠' : value,
                value,
              })),
            },
          },
          {
            field: 'contentPadding',
            label: '内容内边距',
            uiType: 'number',
            props: { min: 0, max: 160 },
          },
          {
            field: 'minHeight',
            label: '最小高度',
            uiType: 'number',
            props: { min: 200, max: 3000 },
          },
          { field: 'footerEnabled', label: '显示页脚', uiType: 'switch' },
          {
            field: 'footerText',
            label: '页脚文本',
            uiType: 'input',
            schema: { type: 'string', maxLength: 500 },
          },
        ],
      },
    ],
  },
});
export default LayoutMaterial;
