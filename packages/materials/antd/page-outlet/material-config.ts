import { lazy } from 'react';
import { defineMaterial } from '@';
const PageOutletMaterial = defineMaterial({
  type: 'PageOutlet',
  title: '页面内容区',
  role: 'layout',
  acceptsChildren: false,
  layout: { display: 'block' },
  defaultProps: {},
  description: '唯一页面内容区，运行时注入当前页面。',
  keywords: ['页面内容区'],
  context: { variables: [], writable: [], actions: [], events: [] },
  usage: '由布局初始化生成，不能删除、复制或移出内容区域。',
  constraints: ['布局中必须唯一且可达。'],
  Component: lazy(() => import('./index')),
  editorConfig: { panels: [] },
});
export default PageOutletMaterial;
