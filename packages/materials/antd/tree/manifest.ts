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
        name: 'selectedKeys',
        description: '选中节点',
      },
      {
        name: 'checkedKeys',
        description: '勾选节点',
      },
      {
        name: 'expandedKeys',
        description: '展开节点',
      },
    ],
    writable: [
      {
        name: 'treeData',
        description: '节点数据',
      },
      {
        name: 'selectedKeys',
        description: '选中节点',
      },
      {
        name: 'checkedKeys',
        description: '勾选节点',
      },
      {
        name: 'expandedKeys',
        description: '展开节点',
      },
    ],
    values: [],
    methods: [
      {
        name: 'onSelect',
        description: '选中节点',
        params: [
          {
            description: '业务参数（event.payload）',
          },
        ],
        linkageShow: [
          {
            field: 'selectable',
            value: true,
          },
        ],
      },
      {
        name: 'onCheck',
        description: '勾选节点',
        params: [
          {
            description: '业务参数（event.payload）',
          },
        ],
        linkageShow: [
          {
            field: 'checkable',
            value: true,
          },
        ],
      },
      {
        name: 'onExpand',
        description: '展开或收起',
        params: [
          {
            description: '业务参数（event.payload）',
          },
        ],
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
    required: [],
  },
  usage: '配置树的属性与展示行为。',
  constraints: ['树节点 key 应唯一。'],
});
