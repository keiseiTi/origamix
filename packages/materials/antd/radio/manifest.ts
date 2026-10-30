import { defineManifest } from '../manifest-definition';

export const radioManifest = defineManifest({
  type: 'radio',
  layout: { display: 'inline' },
  title: '单选框',
  defaultProps: {
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
  description: '从一组选项中选择一个值。',
  keywords: ['单选框', '单选', '选项'],
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
      name: {
        type: 'string',
      },
      optionType: {
        type: 'string',
        enum: ['default', 'button'],
      },
      buttonStyle: {
        type: 'string',
        enum: ['outline', 'solid'],
      },
      size: {
        type: 'string',
        enum: ['large', 'medium', 'small'],
      },
      block: {
        type: 'boolean',
      },
      orientation: {
        type: 'string',
        enum: ['horizontal', 'vertical'],
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
                {
                  type: 'boolean',
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
  usage: '用于互斥选择字段。',
  constraints: ['必须置于 form 中。'],
});
