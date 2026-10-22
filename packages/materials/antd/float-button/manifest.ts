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
    disabled: { type: 'boolean' },
    href: { type: 'string' },
    target: { type: 'string', enum: ['_self', '_blank'] },
    htmlType: { type: 'string', enum: ['button', 'submit', 'reset'] },
  }),
  usage: '为页面提供悬浮的快捷操作入口。',
  constraints: [],
});
