import { defineManifest } from '../manifest-definition';

export const datePickerManifest = defineManifest({
  type: 'datePicker',
  layout: { display: 'inline' },
  title: '日期选择器',
  defaultProps: {
    picker: 'date',
    allowClear: true,
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
        name: 'onOk',
        description: '确认',
        params: [
          {
            description: '业务参数（event.payload）',
          },
        ],
        linkageShow: [
          {
            field: 'needConfirm',
            value: true,
          },
        ],
      },
    ],
  },
  description: '日期选择器属性配置。',
  keywords: ['日期选择器'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      picker: {
        type: 'string',
        enum: ['date', 'week', 'month', 'quarter', 'year'],
      },
      format: {
        type: 'string',
      },
      placeholder: {
        type: 'string',
      },
      defaultValue: {
        type: 'string',
      },
      showTime: {
        type: 'boolean',
      },
      showNow: {
        type: 'boolean',
      },
      inputReadOnly: {
        type: 'boolean',
      },
      needConfirm: {
        type: 'boolean',
      },
      minDate: {
        type: 'string',
      },
      maxDate: {
        type: 'string',
      },
      size: {
        type: 'string',
        enum: ['large', 'medium', 'small'],
      },
      disabled: {
        type: 'boolean',
      },
      allowClear: {
        type: 'boolean',
      },
      status: {
        type: 'string',
        enum: ['error', 'warning'],
      },
      variant: {
        type: 'string',
        enum: ['outlined', 'filled', 'borderless', 'underlined'],
      },
      placement: {
        type: 'string',
        enum: ['bottomLeft', 'bottomRight', 'topLeft', 'topRight'],
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
  usage: '用于表单中的日期选择器。',
  constraints: ['必须置于 form 中。'],
});
