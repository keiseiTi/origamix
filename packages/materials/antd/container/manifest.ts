import { defineManifest } from '../manifest-definition';

export const containerManifest = defineManifest({
  type: 'container',
  title: '容器',
  defaultProps: {
    heightConfig: 'fixed',
    height: 200,
  },
  context: {
    variables: [],
    writable: [],
    values: [],
    methods: [],
  },
  description: '用于组织其他元素并控制区域尺寸和间距。',
  keywords: ['容器', '布局', '分区'],
  role: 'layout',
  acceptsChildren: true,
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      margin: { type: 'number' },
      padding: { type: 'number' },
      heightConfig: {
        type: 'string',
        enum: ['fixed', 'auto'],
      },
      height: {
        type: 'number',
        minimum: 0,
      },
    },
    required: [],
  },
  usage: '用作页面区域或多个物料的父级容器。',
  constraints: ['固定高度仅在 heightConfig 为 fixed 时使用。'],
});
