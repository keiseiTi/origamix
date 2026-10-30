import { defineManifest } from '../manifest-definition';

export const timePickerManifest = defineManifest({
  type: 'timePicker',
  layout: { display: 'inline' },
  title: '时间选择器',
  defaultProps: {
    allowClear: true,
    needConfirm: true,
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
  description: '时间选择器属性配置。',
  keywords: ['时间选择器'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      format: {
        type: 'string',
        enum: ['HH:mm:ss', 'HH:mm', 'hh:mm:ss A'],
      },
      placeholder: {
        type: 'string',
      },
      defaultValue: {
        type: 'string',
      },
      use12Hours: {
        type: 'boolean',
      },
      hourStep: {
        type: 'integer',
        minimum: 1,
        maximum: 23,
      },
      minuteStep: {
        type: 'integer',
        minimum: 1,
        maximum: 59,
      },
      secondStep: {
        type: 'integer',
        minimum: 1,
        maximum: 59,
      },
      hideDisabledOptions: {
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
  usage: '用于表单中的时间选择器。',
  constraints: ['必须置于 form 中。'],
});
