import { containerLayoutConfigs } from '../container-layout-panel';
import { lazy } from 'react';
import { defineMaterial } from '@';
const ContainerMaterial = defineMaterial({
  type: 'container',
  layout: { display: 'block' },
  title: '容器',
  defaultProps: { heightConfig: 'fixed', height: 200 },
  context: { variables: [], writable: [], actions: [], events: [] },
  description: '用于组织其他元素并控制区域尺寸和间距。',
  keywords: ['容器', '布局', '分区'],
  role: 'layout',
  acceptsChildren: true,
  usage: '用作页面区域或多个物料的父级容器。',
  constraints: ['固定高度仅在 heightConfig 为 fixed 时使用。'],
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          ...containerLayoutConfigs.map((config) =>
            config.field === 'padding' ? { ...config, schema: { type: 'number' } } : config,
          ),
          {
            label: '高度配置',
            field: 'heightConfig',
            uiType: 'select',
            props: {
              options: [
                { label: '固定高度', value: 'fixed' },
                { label: '自适应', value: 'auto' },
              ],
            },
          },
          {
            schema: { type: 'number', minimum: 0 },
            label: '高度（px）',
            field: 'height',
            uiType: 'number',
            linkageShow: [{ field: 'heightConfig', value: 'fixed' }],
          },
          { field: 'margin', hidden: true, schema: { type: 'number' }, uiType: 'input' },
        ],
      },
    ],
  },
});
export default ContainerMaterial;
