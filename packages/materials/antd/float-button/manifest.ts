import { defineManifest, emptyContext, objectSchema } from '../manifest-definition';

export const floatButtonManifest = defineManifest({
  type: 'floatButton',
  title: '悬浮按钮',
  defaultProps: { type: 'default', shape: 'circle' },
  context: emptyContext,
  description: '悬浮在页面边缘的快捷操作按钮。',
  keywords: ['悬浮按钮', '快捷操作'],
  role: 'action',
  acceptsChildren: false,
  propsSchema: objectSchema({
    type: { type: 'string', enum: ['default', 'primary'] },
    shape: { type: 'string', enum: ['circle', 'square'] },
    placement: {
      type: 'string',
      enum: ['bottomRight', 'bottomLeft', 'topRight', 'topLeft'],
    },
    description: { type: 'string' },
    tooltip: { type: 'string' },
    disabled: { type: 'boolean' },
    danger: { type: 'boolean' },
  }),
  usage: '为页面提供悬浮的快捷操作入口。',
  constraints: [],
});
