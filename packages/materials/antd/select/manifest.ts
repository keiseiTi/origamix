import { defineManifest, objectSchema } from '../manifest-definition';

export const selectManifest = defineManifest(
  {
    type: 'select',
    title: '选择器',
    defaultProps: {
      placeholder: '请选择',
      size: 'middle',
      options: [
        { label: '选项一', value: 'option1' },
        { label: '选项二', value: 'option2' },
      ],
    },
    context: {
      variables: [
        { name: 'value', description: '当前值' },
        { name: 'disabled', description: '是否禁用' },
        { name: 'options', description: '选项' },
      ],
      values: [],
      methods: [
        {
          name: 'onChange',
          description: '值改变时的回调',
          params: [{ description: '事件参数' }],
        },
      ],
    },
  },
  {
    version: '1.0.0',
    description: '从预定义选项中选择一个或多个值。',
    keywords: ['选择器', '下拉框', '选项'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({
      mode: { type: 'string', enum: ['multiple', 'tags'] },
      placeholder: { type: 'string' },
      allowClear: { type: 'boolean' },
      size: { type: 'string', enum: ['large', 'middle', 'small'] },
      options: {
        type: 'array',
        items: objectSchema({ label: { type: 'string' }, value: { type: ['string', 'boolean'] } }, [
          'label',
          'value',
        ]),
      },
    }),
    usage: '用于枚举值、分类或状态字段。',
    constraints: ['必须置于 form 中。', '每个选项必须包含 label 和 value。'],
  },
);
