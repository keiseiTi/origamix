import { defineSimpleManifest, inputContext, objectSchema } from '../manifest-definition';

export const sliderManifest = defineSimpleManifest(
  {
    type: 'slider',
    title: '滑动输入条',
    defaultProps: {},
    context: {
      variables: [
        { name: 'checked', description: '是否选中' },
        { name: 'disabled', description: '是否禁用' },
      ],
      values: [],
      methods: inputContext.methods,
    },
  },
  {
    description: '通过滑动在数值范围内选值。',
    keywords: ['滑块', '数值', '范围'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({ min: { type: 'number' }, max: { type: 'number' } }),
    usage: '用于直观调整数值。',
    constraints: ['必须置于 form 中。', 'min 不应大于 max。'],
  },
);
