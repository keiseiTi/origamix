import { lazy } from 'react';
import { defineMaterial } from '@';
const LayoutRegionMaterial = defineMaterial({
  type: 'LayoutRegion',
  title: '布局区域',
  role: 'layout',
  acceptsChildren: true,
  layout: { display: 'block' },
  defaultProps: { region: 'content', enabled: true },
  description: '由 Layout 管理的内部区域，不提供拖拽新增入口。',
  keywords: [],
  context: { variables: [], writable: [], actions: [], events: [] },
  usage: '可编辑区域公开属性；不能修改区域身份、派生配置或移动区域。',
  constraints: ['区域身份与位置由 Layout 管理，公开属性由区域管理。'],
  Component: lazy(() =>
    import('../layout/index').then((module) => ({ default: module.LayoutRegion })),
  ),
  editorConfig: {
    panels: [
      {
        title: '区域属性',
        configs: [
          {
            field: 'headerHeight',
            label: '顶部高度（px）',
            uiType: 'number',
            props: { min: 40, max: 200 },
          },
          {
            field: 'headerBackground',
            label: '背景色（留空跟随主题）',
            uiType: 'input',
            schema: { type: 'string', maxLength: 100 },
          },
          { field: 'fixedHeader', label: '固定顶部', uiType: 'switch' },
          {
            field: 'siderWidth',
            label: '侧栏宽度（px）',
            uiType: 'number',
            props: { min: 120, max: 600 },
          },
          { field: 'fixSiderbar', label: '固定侧边栏', uiType: 'switch' },
          { field: 'collapsible', label: '允许展开收起', uiType: 'switch' },
          {
            field: 'contentMargin',
            label: '页面外间距（px）',
            uiType: 'number',
            props: { min: 0, max: 160 },
          },
          {
            field: 'contentPadding',
            label: '内容内边距（px）',
            uiType: 'number',
            props: { min: 0, max: 160 },
          },
          { field: 'breadcrumb', label: '显示面包屑', uiType: 'switch' },
          {
            field: 'footerText',
            label: '页脚文案',
            uiType: 'input',
            schema: { type: 'string', maxLength: 500 },
          },
          {
            field: 'region',
            uiType: 'input',
            hidden: true,
            schema: {
              type: 'string',
              enum: ['header', 'sider', 'content', 'footer', 'body', 'main'],
            },
          },
          { field: 'enabled', uiType: 'switch', hidden: true },
          {
            field: 'config',
            uiType: 'json',
            hidden: true,
            validateValue: () => undefined,
            schema: { type: 'object', additionalProperties: true },
          },
        ],
      },
    ],
  },
});
export default LayoutRegionMaterial;
