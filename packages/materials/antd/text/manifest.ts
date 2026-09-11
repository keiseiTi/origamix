import { defineManifest, objectSchema } from '../manifest-definition';

export const textManifest = defineManifest(
  {
    type: 'text',
    title: '文本',
    defaultProps: { text: '文本' },
    context: {
      variables: [
        { name: 'text', description: '文本内容' },
        { name: 'type', description: '文本类型' },
        { name: 'copyable', description: '是否可复制' },
        { name: 'editable', description: '是否可编辑' },
        { name: 'underline', description: '是否下划线' },
        { name: 'strong', description: '是否加粗' },
        { name: 'italic', description: '是否斜体' },
        { name: 'textType', description: '文本类型' },
        { name: 'ellipsis', description: '是否省略号' },
        { name: 'code', description: '是否代码样式' },
        { name: 'mark', description: '是否标记样式' },
      ],
      values: [],
      methods: [{ name: 'onClick', description: '点击文本时触发' }],
    },
  },
  {
    version: '1.0.0',
    description: '显示标题、段落或普通文本。',
    keywords: ['文本', '标题', '段落'],
    role: 'display',
    acceptsChildren: false,
    propsSchema: objectSchema({
      text: { type: 'string' },
      type: { type: 'string', enum: ['text', 'paragraph', 'h1', 'h2', 'h3', 'h4', 'h5'] },
      textType: { type: 'string', enum: ['secondary', 'success', 'warning', 'danger'] },
      ellipsis: { type: 'boolean' },
      copyable: { type: 'boolean' },
      editable: { type: 'boolean' },
      underline: { type: 'boolean' },
      strong: { type: 'boolean' },
      italic: { type: 'boolean' },
      code: { type: 'boolean' },
      mark: { type: 'boolean' },
    }),
    usage: '用于页面标题、说明和静态文本。',
    constraints: [],
  },
);
