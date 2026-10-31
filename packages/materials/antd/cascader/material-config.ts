import { CascaderDataEditor } from '../../components/structured-editors';
import { lazy } from 'react';
import { defineMaterial } from '@';
const material = defineMaterial({
  type: 'cascader',
  layout: { display: 'inline' },
  title: '级联选择',
  defaultProps: {
    multiple: false,
    allowClear: true,
    options: [{ label: '示例1', value: '示例1' }],
  },
  context: {
    variables: [{ name: 'value', description: '当前值' }],
    writable: [
      { name: 'value', description: '当前值' },
      { name: 'options', description: '选项' },
      { name: 'loading', description: '加载中' },
    ],
    actions: [],
    events: [
      {
        name: 'onChange',
        description: '值改变',
        params: [{ description: '业务参数（event.payload）' }],
      },
    ],
  },
  description: '级联选择属性配置。',
  keywords: ['级联选择'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  usage: '用于表单中的级联选择。',
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
          },
          {
            label: '支持搜索',
            field: 'showSearch',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '选择任意层级',
            field: 'changeOnSelect',
            uiType: 'checkbox',
            defaultValue: false,
            linkageShow: [{ field: 'multiple', value: false }],
          },
          {
            label: '展开方式',
            field: 'expandTrigger',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '点击',
                  value: 'click',
                },
                {
                  label: '悬停',
                  value: 'hover',
                },
              ],
            },
          },
          {
            label: '显示选中策略',
            field: 'showCheckedStrategy',
            uiType: 'select',
            linkageShow: [
              {
                field: 'multiple',
                value: true,
              },
            ],
            props: {
              options: [
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
            label: '最多展示标签数',
            field: 'maxTagCount',
            uiType: 'number',
            props: {
              min: 0,
              step: 1,
            },
          },
          {
            label: '加载中',
            field: 'loading',
            uiType: 'checkbox',
            defaultValue: false,
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
                    label: { type: 'string' },
                    disabled: { type: 'boolean' },
                    isLeaf: { type: 'boolean' },
                    children: { type: 'array', items: { $ref: '#/$defs/option' } },
                  },
                  required: ['value', 'label'],
                },
              },
            },
            field: 'options',
            label: '级联选项',
            uiType: 'custom',
            render: CascaderDataEditor,
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
