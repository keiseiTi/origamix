import { TreeSelectDataEditor } from '../../components/structured-editors';
import { lazy } from 'react';
import { defineMaterial } from '@';
const material = defineMaterial({
  type: 'treeSelect',
  layout: { display: 'inline' },
  title: '树选择器',
  defaultProps: {
    allowClear: true,
    treeData: [{ title: '示例1', value: 'example1', key: 'example1' }],
  },
  context: {
    variables: [{ name: 'value', description: '当前值' }],
    writable: [
      { name: 'value', description: '当前值' },
      { name: 'treeData', description: '节点数据' },
    ],
    values: [],
    methods: [
      {
        name: 'onChange',
        description: '值改变',
        params: [{ description: '业务参数（event.payload）' }],
      },
    ],
  },
  description: '树选择器属性配置。',
  keywords: ['树选择器'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  usage: '用于表单中的树选择器。',
  constraints: ['必须置于 form 中。'],
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '占位符',
            field: 'placeholder',
            uiType: 'input',
          },
          {
            label: '多选',
            field: 'multiple',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '显示复选框',
            field: 'treeCheckable',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '父子独立勾选',
            field: 'treeCheckStrictly',
            uiType: 'checkbox',
            defaultValue: false,
            linkageShow: [
              {
                field: 'treeCheckable',
                value: true,
              },
            ],
          },
          {
            label: '支持搜索',
            field: 'showSearch',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '搜索字段',
            field: 'treeNodeFilterProp',
            uiType: 'select',
            props: {
              options: [
                { label: '标题', value: 'title' },
                { label: '值', value: 'value' },
              ],
            },
          },
          {
            label: '默认展开全部',
            field: 'treeDefaultExpandAll',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '显示连接线',
            field: 'treeLine',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '虚拟滚动',
            field: 'virtual',
            uiType: 'checkbox',
            defaultValue: true,
          },
          {
            label: '弹层高度',
            field: 'listHeight',
            uiType: 'number',
            props: {
              min: 1,
              step: 1,
            },
          },
          {
            label: '最多展示标签数',
            field: 'maxTagCount',
            linkageMode: 'any',
            linkageShow: [
              { field: 'multiple', value: true },
              { field: 'treeCheckable', value: true },
              { field: 'treeCheckStrictly', value: true },
            ],
            uiType: 'number',
            props: {
              min: 0,
              step: 1,
            },
          },
          {
            label: '显示选中策略',
            field: 'showCheckedStrategy',
            uiType: 'select',
            linkageShow: [
              {
                field: 'treeCheckable',
                value: true,
              },
            ],
            props: {
              options: [
                {
                  label: '全部节点',
                  value: 'SHOW_ALL',
                },
                {
                  label: '父节点',
                  value: 'SHOW_PARENT',
                },
                {
                  label: '子节点',
                  value: 'SHOW_CHILD',
                },
              ],
            },
          },
          {
            label: '尺寸',
            field: 'size',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '大',
                  value: 'large',
                },
                {
                  label: '中',
                  value: 'medium',
                },
                {
                  label: '小',
                  value: 'small',
                },
              ],
            },
          },
          {
            label: '禁用',
            field: 'disabled',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '允许清除',
            field: 'allowClear',
            uiType: 'checkbox',
          },
          {
            label: '校验状态',
            field: 'status',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '默认',
                  value: undefined,
                },
                {
                  label: '错误',
                  value: 'error',
                },
                {
                  label: '警告',
                  value: 'warning',
                },
              ],
            },
          },
          {
            label: '外观',
            field: 'variant',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '描边',
                  value: 'outlined',
                },
                {
                  label: '填充',
                  value: 'filled',
                },
                {
                  label: '无边框',
                  value: 'borderless',
                },
                {
                  label: '下划线',
                  value: 'underlined',
                },
              ],
            },
          },
          {
            label: '弹层位置',
            field: 'placement',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '左下',
                  value: 'bottomLeft',
                },
                {
                  label: '右下',
                  value: 'bottomRight',
                },
                {
                  label: '左上',
                  value: 'topLeft',
                },
                {
                  label: '右上',
                  value: 'topRight',
                },
              ],
            },
          },
          {
            schema: {
              type: 'array',
              items: { $ref: '#/$defs/option' },
              $defs: {
                option: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    value: { anyOf: [{ type: 'string' }, { type: 'number' }] },
                    title: { type: 'string' },
                    key: { anyOf: [{ type: 'string' }, { type: 'number' }] },
                    disabled: { type: 'boolean' },
                    isLeaf: { type: 'boolean' },
                    selectable: { type: 'boolean' },
                    disableCheckbox: { type: 'boolean' },
                    checkable: { type: 'boolean' },
                    children: { type: 'array', items: { $ref: '#/$defs/option' } },
                  },
                  required: ['value', 'title'],
                },
              },
            },
            field: 'treeData',
            label: '节点数据',
            uiType: 'custom',
            render: TreeSelectDataEditor,
          },
          { field: 'fieldName', hidden: true, schema: { type: 'string' }, uiType: 'input' },
          { field: 'fieldLabel', hidden: true, schema: { type: 'string' }, uiType: 'input' },
          { field: 'fieldRequired', hidden: true, schema: { type: 'boolean' }, uiType: 'input' },
        ],
      },
    ],
  },
});
export default material;
