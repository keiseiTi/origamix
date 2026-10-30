import { lazy } from 'react';
import { defineMaterial } from '@';
const material = defineMaterial({
  type: 'timePicker',
  layout: { display: 'inline' },
  title: '时间选择器',
  defaultProps: { allowClear: true, needConfirm: true },
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
        name: 'onOk',
        description: '确认',
        params: [{ description: '业务参数（event.payload）' }],
        linkageShow: [{ field: 'needConfirm', value: true }],
      },
    ],
  },
  description: '时间选择器属性配置。',
  keywords: ['时间选择器'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  usage: '用于表单中的时间选择器。',
  constraints: ['必须置于 form 中。'],
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '显示格式',
            field: 'format',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '时分秒',
                  value: 'HH:mm:ss',
                },
                {
                  label: '时分',
                  value: 'HH:mm',
                },
                {
                  label: '12 小时制',
                  value: 'hh:mm:ss A',
                },
              ],
            },
          },
          {
            label: '占位符',
            field: 'placeholder',
            uiType: 'input',
          },
          {
            label: '初始时间（HH:mm:ss）',
            field: 'defaultValue',
            uiType: 'input',
          },
          {
            label: '12 小时制',
            field: 'use12Hours',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            schema: { type: 'integer', minimum: 1, maximum: 23 },
            label: '小时间隔',
            field: 'hourStep',
            uiType: 'number',
            props: {
              min: 1,
              max: 23,
              step: 1,
            },
          },
          {
            schema: { type: 'integer', minimum: 1, maximum: 59 },
            label: '分钟间隔',
            field: 'minuteStep',
            uiType: 'number',
            props: {
              min: 1,
              max: 59,
              step: 1,
            },
          },
          {
            schema: { type: 'integer', minimum: 1, maximum: 59 },
            label: '秒间隔',
            field: 'secondStep',
            uiType: 'number',
            props: {
              min: 1,
              max: 59,
              step: 1,
            },
          },
          {
            label: '隐藏禁用时间',
            field: 'hideDisabledOptions',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '显示此刻',
            field: 'showNow',
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
