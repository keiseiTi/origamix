import { defineManifest } from '../manifest-definition';

export const treeManifest = defineManifest({
  type: 'tree',
  title: '树',
  defaultProps: {
    treeData: [
      {
        title: '节点1',
        key: '0-0',
        children: [
          {
            title: '子节点1',
            key: '0-0-0',
          },
          {
            title: '子节点2',
            key: '0-0-1',
          },
        ],
      },
      {
        title: '节点2',
        key: '0-1',
      },
    ],
    selectable: true,
    virtual: true,
    defaultExpandParent: true,
    defaultExpandAll: false,
    checkable: false,
  },
  context: {
    variables: [
      {
        name: 'treeData',
        description: '树节点数据',
      },
      {
        name: 'selectedKeys',
        description: '选中节点键数组',
      },
      {
        name: 'checkedKeys',
        description: '勾选节点键数组',
      },
    ],
    values: [],
    methods: [
      {
        name: 'onSelect',
        description: '节点选中回调',
      },
      {
        name: 'onCheck',
        description: '节点勾选回调',
      },
    ],
  },
  description: '树的结构与展示属性。',
  keywords: ['树', 'display'],
  role: 'display',
  acceptsChildren: false,
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      treeData: {
        type: 'array',
        items: {
          $ref: '#/$defs/node',
        },
      },
      checkable: {
        type: 'boolean',
      },
      multiple: {
        type: 'boolean',
      },
      defaultExpandAll: {
        type: 'boolean',
      },
      defaultExpandParent: {
        type: 'boolean',
      },
      autoExpandParent: {
        type: 'boolean',
      },
      checkStrictly: {
        type: 'boolean',
      },
      showLine: {
        type: 'boolean',
      },
      showIcon: {
        type: 'boolean',
      },
      draggable: {
        type: 'boolean',
      },
      disabled: {
        type: 'boolean',
      },
      selectable: {
        type: 'boolean',
      },
      blockNode: {
        type: 'boolean',
      },
      virtual: {
        type: 'boolean',
      },
      height: {
        type: 'number',
        minimum: 1,
      },
      defaultExpandedKeys: {
        type: 'array',
        items: {
          anyOf: [
            {
              type: 'string',
            },
            {
              type: 'number',
            },
          ],
        },
      },
      defaultSelectedKeys: {
        type: 'array',
        items: {
          anyOf: [
            {
              type: 'string',
            },
            {
              type: 'number',
            },
          ],
        },
      },
      defaultCheckedKeys: {
        type: 'array',
        items: {
          anyOf: [
            {
              type: 'string',
            },
            {
              type: 'number',
            },
          ],
        },
      },
    },
    $defs: {
      node: {
        type: 'object',
        additionalProperties: false,
        properties: {
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
          disableCheckbox: {
            type: 'boolean',
          },
          checkable: {
            type: 'boolean',
          },
          selectable: {
            type: 'boolean',
          },
          isLeaf: {
            type: 'boolean',
          },
          children: {
            type: 'array',
            items: {
              $ref: '#/$defs/node',
            },
          },
        },
        required: ['title', 'key'],
      },
    },
  },
  usage: '配置树的属性与展示行为。',
  constraints: ['树节点 key 应唯一。'],
});
