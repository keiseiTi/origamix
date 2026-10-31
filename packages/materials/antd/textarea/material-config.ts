import { lazy } from 'react';
import { defineMaterial } from '@';
const material = defineMaterial({
  type: 'textarea',
  layout: { display: 'block' },
  title: '文本域',
  defaultProps: { placeholder: '请输入内容', size: 'medium', autoSize: false },
  context: {
    variables: [{ name: 'value', description: '当前值' }],
    writable: [{ name: 'value', description: '当前值' }],
    actions: [],
    events: [
      {
        name: 'onChange',
        description: '值改变',
        params: [{ description: '业务参数（event.payload）' }],
      },
      {
        name: 'onPressEnter',
        description: '回车',
        params: [{ description: '业务参数（event.payload）' }],
      },
    ],
  },
  description: '录入多行文本。',
  keywords: ['文本域', '多行文本', '备注'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  usage: '用于描述、备注等多行字段。',
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
            label: '初始内容',
            field: 'defaultValue',
            uiType: 'input',
          },
          {
            label: '禁用',
            field: 'disabled',
            uiType: 'checkbox',
          },
          {
            label: '只读',
            field: 'readOnly',
            uiType: 'checkbox',
          },
          {
            label: '允许清除',
            field: 'allowClear',
            uiType: 'checkbox',
          },
          {
            label: '最大长度',
            field: 'maxLength',
            uiType: 'number',
            props: {
              min: 0,
              step: 1,
            },
          },
          {
            label: '显示字数',
            field: 'showCount',
            uiType: 'checkbox',
          },
          {
            schema: {
              anyOf: [
                { type: 'boolean' },
                {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    minRows: { type: 'integer', minimum: 1 },
                    maxRows: { type: 'integer', minimum: 1 },
                  },
                },
              ],
            },
            label: '自动高度',
            field: 'autoSize',

            uiType: 'checkbox',
          },
          {
            label: '行数',
            field: 'rows',
            uiType: 'number',
            props: {
              min: 1,
              step: 1,
            },
            linkageShow: [
              {
                field: 'autoSize',
                value: false,
              },
            ],
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
                  label: '无边框',
                  value: 'borderless',
                },
                {
                  label: '填充',
                  value: 'filled',
                },
                {
                  label: '下划线',
                  value: 'underlined',
                },
              ],
            },
          },
          {
            schema: { type: 'integer', minimum: 1 },
            field: 'minRows',
            label: '最小行数',
            uiType: 'number',
            props: { min: 1, step: 1 },
            linkageShow: [{ field: 'autoSize', value: true }],
          },
          {
            schema: { type: 'integer', minimum: 1 },
            field: 'maxRows',
            label: '最大行数',
            uiType: 'number',
            props: { min: 1, step: 1 },
            linkageShow: [{ field: 'autoSize', value: true }],
          },
          {
            field: 'size',
            hidden: true,
            schema: { type: 'string', enum: ['large', 'medium', 'small'] },
            uiType: 'input',
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
