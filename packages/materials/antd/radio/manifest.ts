import {
  defineSimpleManifest,
  inputContext,
  objectSchema,
  optionsSchema,
} from '../manifest-definition';

export const radioManifest = defineSimpleManifest(
  {
    type: 'radio',
    title: '单选框',
    defaultProps: {
      options: [
        { label: '选项一', value: 'option1' },
        { label: '选项二', value: 'option2' },
      ],
    },
    context: {
      ...inputContext,
      variables: [...inputContext.variables, { name: 'options', description: '选项' }],
    },
  },
  {
    description: '从一组选项中选择一个值。',
    keywords: ['单选框', '单选', '选项'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    documentationUrl: 'https://ant.design/components/radio/#api',
    propsSchema: objectSchema({
      disabled: { type: 'boolean' },
      name: { type: 'string' },
      optionType: { type: 'string', enum: ['default', 'button'] },
      buttonStyle: { type: 'string', enum: ['outline', 'solid'] },
      size: { type: 'string', enum: ['large', 'middle', 'small'] },
      block: { type: 'boolean' },
      orientation: { type: 'string', enum: ['horizontal', 'vertical'] },
      options: optionsSchema,
      optionDisplayButton: { type: 'boolean' },
    }),
    usage: '用于互斥选择字段。',
    constraints: ['必须置于 form 中。'],
  },
);
