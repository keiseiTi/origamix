import { FormValuesEditor } from '../../components/structured-editors';
import { lazy } from 'react';
import { defineMaterial } from '@';
const material = defineMaterial({
  type: 'form',
  layout: { display: 'block' },
  title: '表单容器',
  defaultProps: {
    layout: 'horizontal',
    labelAlign: 'right',
    colon: true,
    preserve: true,
    requiredMark: true,
    initialValues: {},
  },
  context: {
    variables: [{ name: 'value', description: '当前值' }],
    writable: [],
    actions: [
      { name: 'validateFields', description: '校验字段' },
      { name: 'resetFields', description: '重置字段' },
      { name: 'setFieldsValue', description: '设置字段值' },
    ],
    events: [
      {
        name: 'onValuesChange',
        description: '字段值改变',
        params: [{ description: '业务参数（event.payload）' }],
      },
      {
        name: 'onFinish',
        description: '校验成功提交',
        params: [{ description: '业务参数（event.payload）' }],
      },
      {
        name: 'onFinishFailed',
        description: '提交校验失败',
        params: [{ description: '业务参数（event.payload）' }],
      },
    ],
  },
  description: '表单容器的结构与展示属性。',
  keywords: ['表单容器', 'layout'],
  role: 'layout',
  acceptsChildren: true,
  allowedParentTypes: ['basicPage', 'container', 'tabs', 'modal', 'drawer'],
  usage: '配置表单容器的属性与展示行为。',
  constraints: ['不将实例或回调写入 Schema。'],
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            field: 'name',
            label: '表单名称',
            uiType: 'input',
          },
          {
            field: 'layout',
            label: '布局',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '水平',
                  value: 'horizontal',
                },
                {
                  label: '垂直',
                  value: 'vertical',
                },
                {
                  label: '内联',
                  value: 'inline',
                },
              ],
            },
          },
          {
            field: 'size',
            label: '控件尺寸',
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
            field: 'labelAlign',
            label: '标签对齐',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '左对齐',
                  value: 'left',
                },
                {
                  label: '右对齐',
                  value: 'right',
                },
              ],
            },
          },
          {
            schema: { type: 'integer', minimum: 0, maximum: 24 },
            field: 'labelColVal',
            label: '标签栅格跨度',
            uiType: 'number',
            linkageShow: [
              {
                field: 'layout',
                value: 'horizontal',
              },
            ],
            props: {
              min: 0,
              max: 24,
              step: 1,
            },
          },
          {
            schema: { type: 'integer', minimum: 0, maximum: 24 },
            field: 'wrapperColVal',
            label: '控件栅格跨度',
            uiType: 'number',
            linkageShow: [
              {
                field: 'layout',
                value: 'horizontal',
              },
            ],
            props: {
              min: 0,
              max: 24,
              step: 1,
            },
          },
          {
            field: 'labelWrap',
            label: '标签换行',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'colon',
            label: '显示冒号',
            uiType: 'checkbox',
            linkageShow: [
              {
                field: 'layout',
                value: 'horizontal',
              },
            ],
          },
          {
            field: 'disabled',
            label: '禁用表单',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'preserve',
            label: '保留移除字段的值',
            uiType: 'checkbox',
          },
          {
            schema: { anyOf: [{ type: 'boolean' }, { type: 'string', enum: ['optional'] }] },
            field: 'requiredMark',
            label: '必填标记',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '显示必填',
                  value: true,
                },
                {
                  label: '隐藏',
                  value: false,
                },
                {
                  label: '显示可选',
                  value: 'optional',
                },
              ],
            },
          },
          {
            field: 'scrollToFirstError',
            label: '滚动到首个错误',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            field: 'validateTrigger',
            label: '校验时机',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '值改变',
                  value: 'onChange',
                },
                {
                  label: '失去焦点',
                  value: 'onBlur',
                },
              ],
            },
          },
          {
            schema: { type: 'string', enum: ['outlined', 'borderless', 'filled', 'underlined'] },
            field: 'variant',
            label: '控件外观',
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
            schema: { type: 'object' },
            field: 'initialValues',
            label: '初始字段值',
            uiType: 'custom',
            render: FormValuesEditor,
          },
          {
            field: 'clearOnDestroy',
            label: '卸载时清空字段',
            uiType: 'checkbox',
            defaultValue: false,
          },
        ],
      },
    ],
  },
});
export default material;
