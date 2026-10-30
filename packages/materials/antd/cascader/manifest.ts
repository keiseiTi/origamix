import { defineManifest } from '../manifest-definition';

export const cascaderManifest = defineManifest({
  type: 'cascader',
  layout: { display: 'inline' },
  title: '级联选择',
  defaultProps: {
    multiple: false,
    allowClear: true,
    options: [
      {
        label: '示例1',
        value: '示例1',
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
  description: '级联选择属性配置。',
  keywords: ['级联选择'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      placeholder: {
        type: 'string',
      },
      multiple: {
        type: 'boolean',
      },
      showSearch: {
        type: 'boolean',
      },
      changeOnSelect: {
        type: 'boolean',
      },
      expandTrigger: {
        type: 'string',
        enum: ['click', 'hover'],
      },
      showCheckedStrategy: {
        type: 'string',
        enum: ['SHOW_PARENT', 'SHOW_CHILD'],
      },
      maxTagCount: {
        type: 'number',
        minimum: 0,
      },
      loading: {
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
      options: {
        type: 'array',
        items: {
          $ref: '#/$defs/option',
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
    $defs: {
      option: {
        type: 'object',
        additionalProperties: false,
        properties: {
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
          label: {
            type: 'string',
          },
          disabled: {
            type: 'boolean',
          },
          isLeaf: {
            type: 'boolean',
          },
          children: {
            type: 'array',
            items: {
              $ref: '#/$defs/option',
            },
          },
        },
        required: ['value', 'label'],
      },
    },
    required: [],
  },
  usage: '用于表单中的级联选择。',
  constraints: ['必须置于 form 中。'],
});
