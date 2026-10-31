import { lazy } from 'react';
import { defineMaterial } from '@';
const material = defineMaterial({
  type: 'datePicker',
  layout: { display: 'inline' },
  title: '日期选择器',
  defaultProps: { picker: 'date', allowClear: true },
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
        name: 'onOk',
        description: '确认',
        params: [{ description: '业务参数（event.payload）' }],
        linkageShow: [{ field: 'needConfirm', value: true }],
      },
    ],
  },
  description: '日期选择器属性配置。',
  keywords: ['日期选择器'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  usage: '用于表单中的日期选择器。',
  constraints: ['必须置于 form 中。'],
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '选择类型',
            field: 'picker',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '日期',
                  value: 'date',
                },
                {
                  label: '周',
                  value: 'week',
                },
                {
                  label: '月',
                  value: 'month',
                },
                {
                  label: '季度',
                  value: 'quarter',
                },
                {
                  label: '年',
                  value: 'year',
                },
              ],
            },
          },
          {
            label: '显示格式',
            field: 'format',
            uiType: 'input',
          },
          {
            label: '占位符',
            field: 'placeholder',
            uiType: 'input',
          },
          {
            label: '初始日期（YYYY-MM-DD）',
            field: 'defaultValue',
            uiType: 'input',
          },
          {
            label: '选择时间',
            field: 'showTime',
            uiType: 'checkbox',
            defaultValue: false,
            linkageShow: [
              {
                field: 'picker',
                value: 'date',
              },
            ],
          },
          {
            label: '显示今天',
            field: 'showNow',
            linkageShow: [{ field: 'picker', value: 'date' }],
            uiType: 'checkbox',
            defaultValue: true,
          },
          {
            label: '输入只读',
            field: 'inputReadOnly',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '需要确认',
            field: 'needConfirm',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '最早日期（YYYY-MM-DD）',
            field: 'minDate',
            uiType: 'input',
          },
          {
            label: '最晚日期（YYYY-MM-DD）',
            field: 'maxDate',
            uiType: 'input',
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
          { field: 'fieldName', hidden: true, schema: { type: 'string' }, uiType: 'input' },
          { field: 'fieldLabel', hidden: true, schema: { type: 'string' }, uiType: 'input' },
          { field: 'fieldRequired', hidden: true, schema: { type: 'boolean' }, uiType: 'input' },
        ],
      },
    ],
  },
});
export default material;
