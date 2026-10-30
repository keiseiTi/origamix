import { defineManifest } from '../manifest-definition';

export const textManifest = defineManifest({
  type: 'text',
  layout: {
    display: 'inline',
    blockWhen: { prop: 'type', values: ['paragraph', 'h1', 'h2', 'h3', 'h4', 'h5'] },
  },
  title: '文本',
  defaultProps: {
    text: '文本',
  },
  context: {
    variables: [
      {
        name: 'text',
        description: '文本内容',
      },
    ],
    writable: [
      {
        name: 'text',
        description: '文本内容',
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
  description: '显示标题、段落或普通文本。',
  keywords: ['文本', '标题', '段落'],
  role: 'display',
  acceptsChildren: false,
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      delete: {
        type: 'boolean',
      },
      disabled: {
        type: 'boolean',
      },
      text: {
        type: 'string',
      },
      type: {
        type: 'string',
        enum: ['text', 'paragraph', 'h1', 'h2', 'h3', 'h4', 'h5'],
      },
      textType: {
        type: 'string',
        enum: ['secondary', 'success', 'warning', 'danger'],
      },
      ellipsis: {
        type: 'boolean',
      },
      copyable: {
        type: 'boolean',
      },
      underline: {
        type: 'boolean',
      },
      strong: {
        type: 'boolean',
      },
      italic: {
        type: 'boolean',
      },
      code: {
        type: 'boolean',
      },
      mark: {
        type: 'boolean',
      },
    },
    required: [],
  },
  usage: '用于页面标题、说明和静态文本。',
  constraints: [],
});
