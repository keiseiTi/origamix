import { defineManifest } from '../manifest-definition';

export const numberManifest = defineManifest({
  type: 'number',
  title: '数字框',
  defaultProps: {
    placeholder: '请输入',
    size: 'medium',
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
  description: '录入带范围和精度约束的数值。',
  keywords: ['数字框', '数值', '金额'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      step: {
        type: 'number',
        exclusiveMinimum: 0,
      },
      disabled: {
        type: 'boolean',
      },
      readOnly: {
        type: 'boolean',
      },
      controls: {
        type: 'boolean',
      },
      keyboard: {
        type: 'boolean',
      },
      changeOnWheel: {
        type: 'boolean',
      },
      changeOnBlur: {
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
      decimalSeparator: {
        type: 'string',
      },
      defaultValue: {
        type: ['number', 'null'],
      },
      min: {
        type: 'number',
      },
      max: {
        type: 'number',
      },
      precision: {
        type: 'number',
        minimum: 0,
        maximum: 10,
      },
      placeholder: {
        type: 'string',
      },
      size: {
        type: 'string',
        enum: ['large', 'medium', 'small'],
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
  usage: '用于数量、金额、比例等数值字段。',
  constraints: ['必须置于 form 中。', 'min 不应大于 max。'],
});
