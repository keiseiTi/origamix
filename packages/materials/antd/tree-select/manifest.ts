import { defineManifest } from '../manifest-definition';

export const treeSelectManifest = defineManifest({
  type: 'treeSelect',
  layout: { display: 'inline' },
  title: '树选择器',
  defaultProps: {
    allowClear: true,
    treeData: [
      {
        title: '示例1',
        value: 'example1',
        key: 'example1',
      },
    ],
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
      {
        name: 'treeData',
        description: '节点数据',
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
  description: '树选择器属性配置。',
  keywords: ['树选择器'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
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
        enum: ['title', 'value'],
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
        enum: ['large', 'medium', 'small'],
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
          $ref: '#/$defs/option',
        },
      },
      fieldName: {
        type: 'string',
      },
      fieldLabel: {
        type: 'string',
      },
      fieldRequired: { type: 'boolean' },
    },
    $defs: {
      option: {
        type: 'object',
        additionalProperties: false,
        properties: {
          value: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'number',
              },
            ],
          },
          title: {
            type: 'string',
          },
          key: {
            anyOf: [
              {
                type: 'string',
              },
              {
                type: 'number',
              },
            ],
          },
          disabled: {
            type: 'boolean',
          },
          isLeaf: {
            type: 'boolean',
          },
          selectable: {
            type: 'boolean',
          },
          disableCheckbox: {
            type: 'boolean',
          },
          checkable: {
            type: 'boolean',
          },
          children: {
            type: 'array',
            items: {
              $ref: '#/$defs/option',
            },
          },
        },
        required: ['value', 'title'],
      },
    },
    required: [],
  },
  usage: '用于表单中的树选择器。',
  constraints: ['必须置于 form 中。'],
});
