import { defineManifest } from '../manifest-definition';

export const inputManifest = defineManifest({
  type: 'input',
  layout: { display: 'inline' },
  title: '输入框',
  defaultProps: {
    placeholder: '请输入内容',
  },
  context: {
    variables: [
      {
        name: 'value',
        description: '当前值',
      },
    ],
    writable: [
      {
        name: 'value',
        description: '当前值',
      },
    ],
    values: [],
    methods: [
      {
        name: 'onChange',
        description: '值改变',
        params: [
          {
            description: '业务参数（event.payload）',
          },
        ],
      },
      {
        name: 'onPressEnter',
        description: '回车',
        params: [
          {
            description: '业务参数（event.payload）',
          },
        ],
      },
    ],
  },
  description: '录入单行文本。',
  keywords: ['输入框', '文本', '字段'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      defaultValue: {
        type: 'string',
      },
      size: {
        type: 'string',
        enum: ['large', 'medium', 'small'],
      },
      disabled: {
        type: 'boolean',
      },
      readOnly: {
        type: 'boolean',
      },
      status: {
        type: 'string',
        enum: ['error', 'warning'],
      },
      variant: {
        type: 'string',
        enum: ['outlined', 'borderless', 'filled', 'underlined'],
      },
      autoComplete: {
        type: 'string',
        enum: ['on', 'off'],
      },
      type: {
        type: 'string',
        enum: ['text', 'password', 'email', 'tel', 'url'],
      },
      maxLength: {
        type: 'number',
        minimum: 0,
        maximum: 1000,
      },
      placeholder: {
        type: 'string',
      },
      allowClear: {
        type: 'boolean',
      },
      showCount: {
        type: 'boolean',
      },
      fieldName: {
        type: 'string',
      },
      fieldLabel: {
        type: 'string',
      },
      fieldRequired: { type: 'boolean' },
    },
    required: [],
  },
  usage: '用于姓名、标题、账号、邮箱或密码等单行字段；密码字段使用 type=password。',
  constraints: ['必须置于 form 中。'],
});
