import { defineSimpleManifest, objectSchema, inputContext } from '../manifest-definition';
export const sliderManifest = defineSimpleManifest(
  {
    type: 'slider',
    title: '滑动输入条',
    defaultProps: { min: 0, max: 100, step: 1, range: false, keyboard: true, included: true },
    context: inputContext,
  },
  {
    description: '滑动输入条属性配置。',
    keywords: ['滑动输入条'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({
      min: {
        type: 'number',
      },
      max: {
        type: 'number',
      },
      step: {
        type: 'number',
        minimum: 0.01,
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
    }),
    usage: '用于表单中的滑动输入条。',
    constraints: ['必须置于 form 中。'],
  },
);
