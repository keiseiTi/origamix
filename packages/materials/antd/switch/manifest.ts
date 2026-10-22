import { defineManifest } from '../manifest-definition';

export const switchManifest = defineManifest({
  type: 'switch',
  title: '开关',
  defaultProps: {},
  context: {
    variables: [
      {
        name: 'checked',
        description: '是否选中',
      },
    ],
    writable: [
      {
        name: 'checked',
        description: '是否选中',
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
  description: '录入开启或关闭两种状态。',
  keywords: ['开关', '布尔值', '启用'],
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
      loading: {
        type: 'boolean',
      },
      size: {
        type: 'string',
        enum: ['medium', 'small'],
      },
      defaultChecked: {
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
  usage: '用于启用、停用等布尔字段。',
  constraints: ['必须置于 form 中。'],
});
