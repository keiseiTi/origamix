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
  usage:
    '读取当前节点 props.region 确定区域：header 顶部/顶栏，sider 左侧菜单/侧栏，content 页面主体，footer 页脚；body/main 为内部容器。只修改该区域公开属性，不新增、替换或移动受管理区域。',
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
            description: '顶部或顶栏高度，单位 px，默认 64。只修改 header 区域。',
            applicableWhen: { field: 'region', value: 'header' },
            label: '顶部高度（px）',
            uiType: 'number',
            props: { min: 40, max: 200 },
          },
          {
            field: 'headerBackground',
            description:
              '顶部或顶栏背景色，支持 CSS 颜色，例如 #1677ff、blue；空字符串恢复跟随主题。只修改 header 区域。',
            applicableWhen: { field: 'region', value: 'header' },
            label: '背景色（留空跟随主题）',
            uiType: 'color',
            schema: { type: 'string', maxLength: 100 },
          },
          {
            field: 'fixedHeader',
            description: '是否固定顶部：true 表示页面滚动时顶栏仍可见，false 随页面滚动。',
            applicableWhen: { field: 'region', value: 'header' },
            label: '固定顶部',
            uiType: 'switch',
          },
          {
            field: 'siderWidth',
            description: '侧栏展开时的宽度，单位 px，默认 240。不改变菜单文字或内容宽度。',
            applicableWhen: { field: 'region', value: 'sider' },
            label: '侧栏宽度（px）',
            uiType: 'number',
            props: { min: 120, max: 600 },
          },
          {
            field: 'fixSiderbar',
            description: '是否固定侧栏：true 表示页面滚动时侧栏保持可见。',
            applicableWhen: { field: 'region', value: 'sider' },
            label: '固定侧边栏',
            uiType: 'switch',
          },
          {
            field: 'collapsible',
            description: '是否允许用户通过按钮展开/收起侧栏；不是删除或隐藏侧栏。',
            applicableWhen: { field: 'region', value: 'sider' },
            label: '允许展开收起',
            uiType: 'switch',
          },
          {
            field: 'contentMargin',
            description:
              '页面外间距，单位 px，默认 24。控制内容面板到外围布局的留白，四边相同。用户说页面周围留白时修改此项。',
            applicableWhen: { field: 'region', value: 'content' },
            label: '页面外间距（px）',
            uiType: 'number',
            props: { min: 0, max: 160 },
          },
          {
            field: 'contentPadding',
            description:
              '内容内边距，单位 px，默认 24。控制内容面板内部到实际页面内容的留白，四边相同。与页面外间距不同。',
            applicableWhen: { field: 'region', value: 'content' },
            label: '内容内边距（px）',
            uiType: 'number',
            props: { min: 0, max: 160 },
          },
          {
            field: 'breadcrumb',
            description: '是否展示面包屑：false 隐藏当前位置导航；不修改页面路由或菜单。',
            applicableWhen: { field: 'region', value: 'content' },
            label: '显示面包屑',
            uiType: 'switch',
          },
          {
            field: 'footerText',
            description:
              '页脚固定文案，如版权文字。空字符串表示不显示文字；不自动计算年份或执行代码。',
            applicableWhen: { field: 'region', value: 'footer' },
            label: '页脚文案',
            uiType: 'input',
            schema: { type: 'string', maxLength: 500 },
          },
          {
            field: 'region',
            required: true,
            description: '系统管理的区域身份，只读，禁止修改。',
            uiType: 'input',
            hidden: true,
            schema: {
              type: 'string',
              enum: ['header', 'sider', 'content', 'footer', 'body', 'main'],
            },
          },
          {
            field: 'enabled',
            description: '系统按布局模式派生的显示状态，只读，禁止修改。',
            uiType: 'switch',
            hidden: true,
          },
          {
            field: 'config',
            description: '系统派生的渲染配置，只读。修改公开属性即可，不直接修改此对象。',
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
