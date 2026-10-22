import { defineManifest } from '../manifest-definition';

export const checkboxManifest = defineManifest({
  type: 'checkbox',
  title: '复选框',
  defaultProps: {
    options: [
      {
        label: '选项1',
        value: '选项1',
      },
      {
        label: '选项2',
        value: '选项2',
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
  description: '从一组选项中选择零个或多个值。',
  keywords: ['复选框', '多选', '选项'],
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
  usage: '用于多选字段。',
  constraints: ['必须置于 form 中。'],
});
