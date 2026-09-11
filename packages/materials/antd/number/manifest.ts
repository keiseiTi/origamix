import { defineSimpleManifest, inputContext, objectSchema } from '../manifest-definition';

export const numberManifest = defineSimpleManifest(
  {
    type: 'number',
    title: '数字框',
    defaultProps: { placeholder: '请输入', size: 'middle' },
    context: {
      ...inputContext,
      methods: [
        ...inputContext.methods,
        {
          name: 'onPressEnter',
          description: '回车的回调',
          params: [{ description: '事件参数' }],
        },
      ],
    },
  },
  {
    description: '录入带范围和精度约束的数值。',
    keywords: ['数字框', '数值', '金额'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({
      defaultValue: { type: 'number' },
      min: { type: 'number' },
      max: { type: 'number' },
      precision: { type: 'number', minimum: 0, maximum: 10 },
      prefix: { type: 'string' },
      suffix: { type: 'string' },
      addonBefore: { type: 'string' },
      addonAfter: { type: 'string' },
      placeholder: { type: 'string' },
      allowClear: { type: 'boolean' },
      size: { type: 'string', enum: ['large', 'middle', 'small'] },
    }),
    usage: '用于数量、金额、比例等数值字段。',
    constraints: ['必须置于 form 中。', 'min 不应大于 max。'],
  },
);
