import { defineManifest, objectSchema } from '../manifest-definition';

export const containerManifest = defineManifest(
  {
    type: 'container',
    title: '容器',
    defaultProps: { heightConfig: 'fixed', height: 200 },
    context: { variables: [], values: [], methods: [] },
  },
  {
    version: '1.0.0',
    description: '用于组织其他元素并控制区域尺寸和间距。',
    keywords: ['容器', '布局', '分区'],
    role: 'layout',
    acceptsChildren: true,
    propsSchema: objectSchema({
      heightConfig: { type: 'string', enum: ['fixed', 'auto'] },
      height: { type: 'number', minimum: 0 },
      margin: { type: 'number' },
      padding: { type: 'number' },
    }),
    usage: '用作页面区域或多个物料的父级容器。',
    constraints: ['固定高度仅在 heightConfig 为 fixed 时使用。'],
  },
);
