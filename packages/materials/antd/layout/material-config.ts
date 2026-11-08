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
    '根节点管理布局模式、站点标识和内容宽度。点击顶部、侧栏、页面主体、页脚配置各区域。切换模式保留区域内容。',
  constraints: ['必须保留唯一 PageOutlet，不能删除或移动受管理区域。'],
  Component: lazy(() => import('./index').then((module) => ({ default: module.Layout }))),
  editorConfig: {
    panels: [
      {
        title: '布局模式',
        configs: [
          {
            field: 'variant',
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
            label: '站点标题',
            uiType: 'input',
            schema: { type: 'string', maxLength: 120 },
          },
          {
            field: 'logo',
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
            uiType: 'json',
            hidden: true,
            validateValue: () => undefined,
            schema: { type: 'object', additionalProperties: true },
          },
          {
            field: 'contentWidth',
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
