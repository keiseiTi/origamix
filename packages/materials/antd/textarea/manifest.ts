import { defineManifest } from '../manifest-definition';

export const textareaManifest = defineManifest({
  type: 'textarea',
  layout: { display: 'block' },
  title: '文本域',
  defaultProps: {
    placeholder: '请输入内容',
    size: 'medium',
    autoSize: false,
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
  description: '录入多行文本。',
  keywords: ['文本域', '多行文本', '备注'],
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
      disabled: {
        type: 'boolean',
      },
      readOnly: {
        type: 'boolean',
      },
      allowClear: {
        type: 'boolean',
      },
      rows: {
        type: 'number',
        minimum: 1,
      },
      status: {
        type: 'string',
        enum: ['error', 'warning'],
      },
      variant: {
        type: 'string',
        enum: ['outlined', 'borderless', 'filled', 'underlined'],
      },
      maxLength: {
        type: 'number',
        minimum: 0,
      },
      showCount: {
        type: 'boolean',
      },
      placeholder: {
        type: 'string',
      },
      autoSize: {
        anyOf: [
          {
            type: 'boolean',
          },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              minRows: {
                type: 'integer',
                minimum: 1,
              },
              maxRows: {
                type: 'integer',
                minimum: 1,
              },
            },
          },
        ],
      },
      size: {
        type: 'string',
        enum: ['large', 'medium', 'small'],
      },
      minRows: {
        type: 'integer',
        minimum: 1,
      },
      maxRows: {
        type: 'integer',
        minimum: 1,
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
  usage: '用于描述、备注等多行字段。',
  constraints: ['必须置于 form 中。'],
});
