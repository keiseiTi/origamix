import { hierarchicalOptionsSchema } from '../hierarchical-options-schema';
import { defineSimpleManifest, inputContext } from '../manifest-definition';
export const treeSelectManifest = defineSimpleManifest(
  {
    type: 'treeSelect',
    title: '树选择器',
    defaultProps: {
      allowClear: true,
      treeData: [{ title: '示例1', value: 'example1', key: 'example1' }],
    },
    context: {
      ...inputContext,
      variables: [...inputContext.variables, { name: 'treeData', description: '选项数据' }],
    },
  },
  {
    description: '树选择器属性配置。',
    keywords: ['树选择器'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: hierarchicalOptionsSchema('treeData', {
      placeholder: {
        type: 'string',
      },
      multiple: {
        type: 'boolean',
      },
      treeCheckable: {
        type: 'boolean',
      },
      treeCheckStrictly: {
        type: 'boolean',
      },
      showSearch: {
        type: 'boolean',
      },
      treeNodeFilterProp: {
        type: 'string',
      },
      treeDefaultExpandAll: {
        type: 'boolean',
      },
      treeLine: {
        type: 'boolean',
      },
      virtual: {
        type: 'boolean',
      },
      listHeight: {
        type: 'number',
        minimum: 1,
      },
      maxTagCount: {
        type: 'number',
        minimum: 0,
      },
      showCheckedStrategy: {
        type: 'string',
        enum: ['SHOW_ALL', 'SHOW_PARENT', 'SHOW_CHILD'],
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
      treeData: {
        type: 'array',
        items: {
          type: 'object',
        },
      },
      options: {
        type: 'array',
        items: {
          type: 'object',
        },
      },
    }),
    usage: '用于表单中的树选择器。',
    constraints: ['必须置于 form 中。'],
  },
);
