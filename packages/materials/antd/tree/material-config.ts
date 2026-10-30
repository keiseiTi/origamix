import { TreeDataEditor, KeysEditor } from '../../components/structured-editors';
import { lazy } from 'react';
import { defineMaterial } from '@';
const material = defineMaterial({
  type: 'tree',
  layout: { display: 'block' },
  title: '树',
  defaultProps: {
    treeData: [
      {
        title: '节点1',
        key: '0-0',
        children: [
          { title: '子节点1', key: '0-0-0' },
          { title: '子节点2', key: '0-0-1' },
        ],
      },
      { title: '节点2', key: '0-1' },
    ],
    selectable: true,
    virtual: true,
    defaultExpandParent: true,
    defaultExpandAll: false,
    checkable: false,
  },
  context: {
    variables: [
      { name: 'selectedKeys', description: '选中节点' },
      { name: 'checkedKeys', description: '勾选节点' },
      { name: 'expandedKeys', description: '展开节点' },
    ],
    writable: [
      { name: 'treeData', description: '节点数据' },
      { name: 'selectedKeys', description: '选中节点' },
      { name: 'checkedKeys', description: '勾选节点' },
      { name: 'expandedKeys', description: '展开节点' },
    ],
    values: [],
    methods: [
      {
        name: 'onSelect',
        description: '选中节点',
        params: [{ description: '业务参数（event.payload）' }],
        linkageShow: [{ field: 'selectable', value: true }],
      },
      {
        name: 'onCheck',
        description: '勾选节点',
        params: [{ description: '业务参数（event.payload）' }],
        linkageShow: [{ field: 'checkable', value: true }],
      },
      {
        name: 'onExpand',
        description: '展开或收起',
        params: [{ description: '业务参数（event.payload）' }],
      },
    ],
  },
  description: '树的结构与展示属性。',
  keywords: ['树', 'display'],
  role: 'display',
  acceptsChildren: false,
  usage: '配置树的属性与展示行为。',
  constraints: ['树节点 key 应唯一。'],
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            schema: {
              type: 'array',
              items: { $ref: '#/$defs/node' },
              $defs: {
                node: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    title: { type: 'string' },
                    key: { anyOf: [{ type: 'string' }, { type: 'number' }] },
                    disabled: { type: 'boolean' },
                    disableCheckbox: { type: 'boolean' },
                    checkable: { type: 'boolean' },
                    selectable: { type: 'boolean' },
                    isLeaf: { type: 'boolean' },
                    children: { type: 'array', items: { $ref: '#/$defs/node' } },
                  },
                  required: ['title', 'key'],
                },
              },
            },
            field: 'treeData',
            label: '树节点',
            uiType: 'custom',
            render: TreeDataEditor,
          },
          {
            field: 'checkable',
            label: '显示复选框',
            uiType: 'checkbox',
          },
          {
            field: 'checkStrictly',
            label: '父子勾选独立',
            uiType: 'checkbox',
            defaultValue: false,
            linkageShow: [
              {
                field: 'checkable',
                value: true,
              },
            ],
          },
          {
            field: 'multiple',
            label: '允许多选',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'selectable',
            label: '允许选中',
            uiType: 'checkbox',
          },
          {
            field: 'disabled',
            label: '禁用',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'defaultExpandAll',
            label: '默认展开全部',
            uiType: 'checkbox',
          },
          {
            field: 'defaultExpandParent',
            label: '默认展开父节点',
            uiType: 'checkbox',
          },
          {
            field: 'autoExpandParent',
            label: '自动展开父节点',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            schema: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }] } },
            field: 'defaultExpandedKeys',
            label: '默认展开节点键',
            linkageShow: [
              {
                field: 'defaultExpandAll',
                value: false,
              },
            ],
            uiType: 'custom',
            render: KeysEditor,
          },
          {
            schema: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }] } },
            field: 'defaultSelectedKeys',
            label: '默认选中节点键',
            linkageShow: [
              {
                field: 'selectable',
                value: true,
              },
            ],
            uiType: 'custom',
            render: KeysEditor,
          },
          {
            schema: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }] } },
            field: 'defaultCheckedKeys',
            label: '默认勾选节点键',
            linkageShow: [
              {
                field: 'checkable',
                value: true,
              },
            ],
            uiType: 'custom',
            render: KeysEditor,
          },
          {
            field: 'showLine',
            label: '显示连接线',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'blockNode',
            label: '节点占满一行',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'virtual',
            label: '虚拟滚动',
            uiType: 'checkbox',
          },
          {
            field: 'height',
            label: '滚动区域高度',
            uiType: 'number',
            props: {
              min: 1,
            },
          },
        ],
      },
    ],
  },
});
export default material;
