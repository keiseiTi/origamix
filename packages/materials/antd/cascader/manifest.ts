import { hierarchicalOptionsSchema } from '../hierarchical-options-schema';
import { defineSimpleManifest, inputContext } from '../manifest-definition';
export const cascaderManifest = defineSimpleManifest(
  {
    type: 'cascader',
    title: '级联选择',
    defaultProps: { allowClear: true, options: [{ label: '示例1', value: '示例1' }] },
    context: {
      ...inputContext,
      variables: [...inputContext.variables, { name: 'options', description: '选项数据' }],
    },
  },
  {
    description: '级联选择属性配置。',
    keywords: ['级联选择'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    documentationUrl: 'https://ant.design/components/cascader/#api',
    propsSchema: hierarchicalOptionsSchema('options', {
      placeholder: {
        type: 'string',
      },
      multiple: {
        type: 'boolean',
      },
      showSearch: {
        type: 'boolean',
      },
      changeOnSelect: {
        type: 'boolean',
      },
      expandTrigger: {
        type: 'string',
        enum: ['click', 'hover'],
      },
      showCheckedStrategy: {
        type: 'string',
        enum: ['SHOW_PARENT', 'SHOW_CHILD'],
      },
      maxTagCount: {
        type: 'number',
        minimum: 0,
      },
      loading: {
        type: 'boolean',
      },
      size: {
        type: 'string',
        enum: ['large', 'middle', 'small'],
      },
      disabled: {
        type: 'boolean',
      },
      allowClear: {
        type: 'boolean',
      },
      status: {
        type: 'string',
        enum: ['error', 'warning'],
      },
      variant: {
        type: 'string',
        enum: ['outlined', 'filled', 'borderless', 'underlined'],
      },
      placement: {
        type: 'string',
        enum: ['bottomLeft', 'bottomRight', 'topLeft', 'topRight'],
      },
      options: {
        type: 'array',
        items: {
          type: 'object',
        },
      },
    }),
    usage: '用于表单中的级联选择。',
    constraints: ['必须置于 form 中。'],
  },
);
