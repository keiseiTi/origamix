import { containerLayoutConfigs } from '../container-layout-panel';
import { lazy } from 'react';
import { defineMaterial } from '@';
const BasicPageMaterial = defineMaterial({
  type: 'basicPage',
  layout: { display: 'block' },
  title: '页面',
  defaultProps: { display: 'flow', flexDirection: 'column' },
  context: { variables: [], writable: [], values: [], methods: [] },
  description: '页面内容的根布局容器。',
  keywords: ['页面', '根容器', '布局'],
  role: 'layout',
  acceptsChildren: true,
  usage: '作为页面 Schema 的根节点承载其他物料。',
  constraints: ['每个页面只能有一个根页面容器。'],
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          ...containerLayoutConfigs,
          { field: 'margin', hidden: true, schema: { type: 'number' }, uiType: 'input' },
        ],
      },
    ],
  },
});
export default BasicPageMaterial;
