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
  usage: '不要直接编辑内部区域属性或移动区域，使用 Layout 根节点的布局设置。可在区域内添加内容。',
  constraints: ['内部区域类型、显示与尺寸由 Layout 根属性派生。'],
  Component: lazy(() =>
    import('../layout/index').then((module) => ({ default: module.LayoutRegion })),
  ),
  editorConfig: {
    panels: [
      {
        title: '内部配置',
        configs: [
          {
            field: 'region',
            uiType: 'input',
            hidden: true,
            schema: { type: 'string', enum: ['header', 'sider', 'content', 'footer', 'body'] },
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
