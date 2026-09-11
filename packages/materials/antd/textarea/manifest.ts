import { defineSimpleManifest, inputContext, objectSchema } from '../manifest-definition';

export const textareaManifest = defineSimpleManifest(
  {
    type: 'textarea',
    title: '文本域',
    defaultProps: { placeholder: '请输入内容', size: 'middle' },
    context: {
      ...inputContext,
      methods: [
        ...inputContext.methods,
        { name: 'onPressEnter', description: '回车的回调', params: [{ description: '事件参数' }] },
      ],
    },
  },
  {
    description: '录入多行文本。',
    keywords: ['文本域', '多行文本', '备注'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({
      maxLength: { type: 'number', minimum: 0 },
      showCount: { type: 'boolean' },
      placeholder: { type: 'string' },
      autoSize: { type: ['boolean', 'object'] },
      size: { type: 'string', enum: ['large', 'middle', 'small'] },
    }),
    usage: '用于描述、备注等多行字段。',
    constraints: ['必须置于 form 中。'],
  },
);
