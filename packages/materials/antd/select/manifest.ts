import { defineManifest } from '../manifest-definition';

export const selectManifest = defineManifest({
  type: 'select',
  layout: { display: 'inline' },
  title: '选择器',
  defaultProps: {
    placeholder: '请选择',
    size: 'medium',
    options: [
      {
        label: '选项一',
        value: 'option1',
      },
      {
        label: '选项二',
        value: 'option2',
      },
    ],
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
      {
        name: 'options',
        description: '选项',
      },
      {
        name: 'loading',
        description: '加载中',
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
    ],
  },
  description: '从预定义选项中选择一个或多个值。',
  keywords: ['选择器', '下拉框', '选项'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      disabled: {
        type: 'boolean',
      },
      showSearch: {
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
      loading: {
        type: 'boolean',
      },
      maxTagCount: {
        type: 'number',
        minimum: 0,
      },
      listHeight: {
        type: 'number',
        minimum: 1,
      },
      virtual: {
        type: 'boolean',
      },
      placement: {
        type: 'string',
        enum: ['bottomLeft', 'bottomRight', 'topLeft', 'topRight'],
      },
      mode: {
        type: 'string',
        enum: ['multiple', 'tags'],
      },
      placeholder: {
        type: 'string',
      },
      allowClear: {
        type: 'boolean',
      },
      size: {
        type: 'string',
        enum: ['large', 'medium', 'small'],
      },
      options: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            label: {
              type: 'string',
            },
            value: {
              anyOf: [
                {
                  type: 'string',
                },
                {
                  type: 'number',
                },
              ],
            },
            disabled: {
              type: 'boolean',
            },
          },
          required: ['label', 'value'],
        },
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
  usage: '用于枚举值、分类或状态字段。',
  constraints: ['必须置于 form 中。', '每个选项必须包含 label 和 value。'],
});
