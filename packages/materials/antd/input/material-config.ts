import { lazy } from 'react';
import { defineMaterial } from '@';
const InputMaterial = defineMaterial({
  type: 'input',
  layout: { display: 'inline' },
  title: '输入框',
  defaultProps: { placeholder: '请输入内容' },
  context: {
    variables: [{ name: 'value', description: '当前值' }],
    writable: [{ name: 'value', description: '当前值' }],
    values: [],
    methods: [
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
  description: '录入单行文本。',
  keywords: ['输入框', '文本', '字段'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  usage: '用于姓名、标题、账号、邮箱或密码等单行字段；密码字段使用 type=password。',
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
            label: '输入类型',
            field: 'type',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '文本',
                  value: 'text',
                },
                {
                  label: '密码',
                  value: 'password',
                },
                {
                  label: '邮箱',
                  value: 'email',
                },
                {
                  label: '电话',
                  value: 'tel',
                },
                {
                  label: '网址',
                  value: 'url',
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
            schema: { type: 'number', minimum: 0, maximum: 1000 },
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
            label: '自动填充',
            field: 'autoComplete',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '默认',
                  value: undefined,
                },
                {
                  label: '开启',
                  value: 'on',
                },
                {
                  label: '关闭',
                  value: 'off',
                },
              ],
            },
          },
          { field: 'fieldName', hidden: true, schema: { type: 'string' }, uiType: 'input' },
          { field: 'fieldLabel', hidden: true, schema: { type: 'string' }, uiType: 'input' },
          { field: 'fieldRequired', hidden: true, schema: { type: 'boolean' }, uiType: 'input' },
        ],
      },
    ],
  },
});
export default InputMaterial;
