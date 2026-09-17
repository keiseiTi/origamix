import { defineSimpleManifest, emptyContext, objectSchema } from '../manifest-definition';

export const basicPageManifest = defineSimpleManifest(
  {
    type: 'basicPage',
    title: '页面',
    defaultProps: { display: 'flow', flexDirection: 'column' },
    context: emptyContext,
  },
  {
    description: '页面内容的根布局容器。',
    keywords: ['页面', '根容器', '布局'],
    role: 'layout',
    propsSchema: objectSchema({
      display: { type: 'string', enum: ['flow', 'flex'] },
      flexDirection: { type: 'string', enum: ['column', 'row'] },
      margin: { type: 'number' },
      padding: { type: 'number' },
    }),
    acceptsChildren: true,
    usage: '作为页面 Schema 的根节点承载其他物料。',
    constraints: ['每个页面只能有一个根页面容器。'],
  },
);
