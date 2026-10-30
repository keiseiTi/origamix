import { defineManifest } from '../manifest-definition';

export const buttonManifest = defineManifest({
  type: 'button',
  layout: { display: 'inline', blockWhen: { prop: 'block', values: ['true'] } },
  title: '按钮',
  defaultProps: {
    text: '按钮',
    type: 'default',
    size: 'medium',
  },
  context: {
    variables: [
      {
        name: 'text',
        description: '文本内容',
      },
      {
        name: 'loading',
        description: '加载中',
      },
    ],
    writable: [
      {
        name: 'text',
        description: '文本内容',
      },
      {
        name: 'loading',
        description: '加载中',
      },
    ],
    values: [],
    methods: [
      {
        name: 'onClick',
        description: '点击',
        params: [
          {
            description: '业务参数（event.payload）',
          },
        ],
      },
    ],
  },
  description: '触发提交、重置、跳转或其他页面操作。',
  keywords: ['按钮', '提交', '操作'],
  role: 'action',
  acceptsChildren: false,
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      disabled: {
        type: 'boolean',
      },
      loading: {
        type: 'boolean',
      },
      danger: {
        type: 'boolean',
      },
      block: {
        type: 'boolean',
      },
      htmlType: {
        type: 'string',
        enum: ['button', 'submit', 'reset'],
      },
      text: {
        type: 'string',
      },
      type: {
        type: 'string',
        enum: ['default', 'primary', 'dashed', 'link', 'text'],
      },
      size: {
        type: 'string',
        enum: ['large', 'medium', 'small'],
      },
      shape: {
        type: 'string',
        enum: ['circle', 'round'],
      },
      href: {
        type: 'string',
      },
      target: {
        type: 'string',
        enum: ['_self', '_blank'],
      },
      ghost: {
        type: 'boolean',
      },
    },
    required: [],
  },
  usage: '为表单或页面提供清晰的用户操作入口。',
  constraints: ['仅在配置 href 时使用 target。'],
});
