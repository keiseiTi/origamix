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
  description: '应用布局：选择左侧、顶部或混合菜单，配置站点标识与内容宽度。',
  keywords: ['Layout', '布局', '导航'],
  context: { variables: [], writable: [], actions: [], events: [] },
  usage:
    '用于项目唯一布局根节点。系统名称、应用名称、站点标题均修改 title；Logo 修改 logo。左侧菜单=side，顶部菜单=top，顶部贯穿全宽且下方有侧栏的混合菜单=mix。自适应=Fluid，定宽居中=Fixed（contentMaxWidth 单位 px）。只用 updateElementProps 修改；切换模式保留其他属性及区域内容。',
  constraints: ['必须保留唯一 PageOutlet，不能删除或移动受管理区域。'],
  Component: lazy(() => import('./index').then((module) => ({ default: module.Layout }))),
  editorConfig: {
    panels: [
      {
        title: '布局模式',
        configs: [
          {
            field: 'variant',
            description:
              '布局模式：side 左侧菜单贯穿全高；top 仅顶部菜单；mix 顶部贯穿全宽，侧栏位于顶部下方。只调整结构，不重建节点。',
            label: '导航布局',
            uiType: 'custom',
            render: lazy(() => import('./mode-picker')),
            schema: { type: 'string', enum: ['side', 'top', 'mix'] },
          },
        ],
      },
      {
        title: '站点标识',
        configs: [
          {
            field: 'title',
            description:
              '站点标题，也称系统名称、应用名称。侧边布局显示在侧栏顶部，其他模式显示在顶栏左侧。不是页面标题或 Header 内新增文本。',
            label: '站点标题',
            uiType: 'input',
            schema: { type: 'string', maxLength: 120 },
          },
          {
            field: 'logo',
            description:
              '站点 Logo 图片地址。使用用户提供的有效图片 URL；空字符串表示不显示 Logo，不能编造地址。',
            label: 'Logo 地址',
            uiType: 'input',
            schema: { type: 'string', maxLength: 2048 },
          },
        ],
      },
      {
        title: '内容宽度',
        configs: [
          {
            field: 'regionConfig',
            description: '系统派生的区域几何配置，只读。Agent 禁止设置、删除或复制该字段。',
            uiType: 'json',
            hidden: true,
            validateValue: () => undefined,
            schema: { type: 'object', additionalProperties: true },
          },
          {
            field: 'contentWidth',
            description:
              '页面主体宽度：Fluid 填满可用区域，Fixed 按 contentMaxWidth 定宽居中。顶部和侧栏不受此宽度影响。',
            label: '宽度模式',
            uiType: 'select',
            props: {
              options: [
                { label: '自适应', value: 'Fluid' },
                { label: '定宽居中', value: 'Fixed' },
              ],
            },
          },
          {
            field: 'contentMaxWidth',
            description:
              '页面主体在 Fixed 模式下的最大宽度，单位 px；Fluid 模式下保留配置但不影响渲染。',
            label: '最大宽度（px）',
            uiType: 'number',
            props: { min: 320, max: 2560 },
            linkageShow: [{ field: 'contentWidth', value: 'Fixed' }],
          },
        ],
      },
    ],
  },
});
export default LayoutMaterial;
