import { defineManifest, objectSchema } from '../manifest-definition';

export const inputManifest = defineManifest(
  {
    type: 'input',
    title: '输入框',
    defaultProps: { placeholder: '请输入内容' },
    context: {
      variables: [
        { name: 'value', description: '当前值' },
        { name: 'disabled', description: '是否禁用' },
      ],
      values: [],
      methods: [
        { name: 'onChange', description: '值改变时的回调', params: [{ description: '事件参数' }] },
        { name: 'onPressEnter', description: '回车的回调', params: [{ description: '事件参数' }] },
      ],
    },
  },
  {
    version: '1.0.0',
    description: '录入单行文本。',
    keywords: ['输入框', '文本', '字段'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({
      type: { type: 'string', enum: ['text', 'password', 'email'] },
      maxLength: { type: 'number', minimum: 0, maximum: 1000 },
      addonBefore: { type: 'string' },
      addonAfter: { type: 'string' },
      placeholder: { type: 'string' },
      allowClear: { type: 'boolean' },
      showCount: { type: 'boolean' },
    }),
    usage: '用于姓名、标题、账号、邮箱或密码等单行字段；密码字段使用 type=password。',
    constraints: ['必须置于 form 中。'],
  },
);
