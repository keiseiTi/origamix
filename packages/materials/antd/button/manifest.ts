import { defineManifest, objectSchema } from '../manifest-definition';

export const buttonManifest = defineManifest(
  {
    type: 'button',
    title: '按钮',
    defaultProps: { text: '按钮', type: 'default', size: 'middle' },
    context: {
      variables: [
        { name: 'text', description: '按钮文本' },
        { name: 'disabled', description: '禁用按钮' },
        { name: 'loading', description: '按钮载入状态' },
      ],
      values: [],
      methods: [
        {
          name: 'onClick',
          description: '点击事件',
          params: [{ description: '事件参数' }],
        },
      ],
    },
  },
  {
    version: '1.0.0',
    description: '触发提交、重置、跳转或其他页面操作。',
    keywords: ['按钮', '提交', '操作'],
    role: 'action',
    acceptsChildren: false,
    propsSchema: objectSchema({
      text: { type: 'string' },
      type: { type: 'string', enum: ['default', 'primary', 'dashed', 'link', 'text'] },
      size: { type: 'string', enum: ['large', 'middle', 'small'] },
      shape: { type: 'string', enum: ['circle', 'round'] },
      href: { type: 'string' },
      target: { type: 'string', enum: ['_self', '_blank'] },
      ghost: { type: 'boolean' },
    }),
    usage: '为表单或页面提供清晰的用户操作入口。',
    constraints: ['仅在配置 href 时使用 target。'],
  },
);
