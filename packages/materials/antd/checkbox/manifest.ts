import {
  defineSimpleManifest,
  inputContext,
  objectSchema,
  optionsSchema,
} from '../manifest-definition';

export const checkboxManifest = defineSimpleManifest(
  {
    type: 'checkbox',
    title: '复选框',
    defaultProps: {
      options: [
        { label: '选项1', value: '选项1' },
        { label: '选项2', value: '选项2' },
      ],
    },
    context: {
      ...inputContext,
      variables: [...inputContext.variables, { name: 'options', description: '选项' }],
    },
  },
  {
    description: '从一组选项中选择零个或多个值。',
    keywords: ['复选框', '多选', '选项'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({ options: optionsSchema }),
    usage: '用于多选字段。',
    constraints: ['必须置于 form 中。'],
  },
);
