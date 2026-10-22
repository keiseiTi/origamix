import { defineManifest } from '../manifest-definition';

export const sliderManifest = defineManifest({
  type: 'slider',
  title: '滑动输入条',
  defaultProps: {
    min: 0,
    max: 100,
    step: 1,
    range: false,
    keyboard: true,
    included: true,
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
        name: 'onChangeComplete',
        description: '调整完成',
        params: [
          {
            description: '业务参数（event.payload）',
          },
        ],
      },
    ],
  },
  description: '滑动输入条属性配置。',
  keywords: ['滑动输入条'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      min: {
        type: 'number',
      },
      max: {
        type: 'number',
      },
      step: {
        type: 'number',
        exclusiveMinimum: 0,
      },
      range: {
        type: 'boolean',
      },
      defaultValue: {
        anyOf: [
          {
            type: 'number',
          },
          {
            type: 'array',
            items: {
              type: 'number',
            },
            minItems: 2,
            maxItems: 2,
          },
        ],
      },
      defaultStart: {
        type: 'number',
      },
      defaultEnd: {
        type: 'number',
      },
      disabled: {
        type: 'boolean',
      },
      keyboard: {
        type: 'boolean',
      },
      reverse: {
        type: 'boolean',
      },
      vertical: {
        type: 'boolean',
      },
      dots: {
        type: 'boolean',
      },
      included: {
        type: 'boolean',
      },
      draggableTrack: {
        type: 'boolean',
      },
      tooltipMode: {
        type: 'string',
        enum: ['auto', 'always', 'hidden'],
      },
      tooltipPlacement: {
        type: 'string',
        enum: ['top', 'bottom', 'left', 'right'],
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
  usage: '用于表单中的滑动输入条。',
  constraints: ['必须置于 form 中。'],
});
