import { lazy } from 'react';
import { defineMaterial } from '@';
const material = defineMaterial({
  type: 'slider',
  layout: { display: 'block' },
  title: '滑动输入条',
  defaultProps: { min: 0, max: 100, step: 1, range: false, keyboard: true, included: true },
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
        name: 'onChangeComplete',
        description: '调整完成',
        params: [{ description: '业务参数（event.payload）' }],
      },
    ],
  },
  description: '滑动输入条属性配置。',
  keywords: ['滑动输入条'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  usage: '用于表单中的滑动输入条。',
  constraints: ['必须置于 form 中。'],
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '最小值',
            field: 'min',
            uiType: 'number',
            props: {
              step: 1,
            },
          },
          {
            label: '最大值',
            field: 'max',
            uiType: 'number',
            props: {
              step: 1,
            },
          },
          {
            schema: { type: 'number', exclusiveMinimum: 0 },
            label: '步长',
            field: 'step',
            uiType: 'number',
            props: {
              min: 0.01,
              step: 0.1,
            },
          },
          {
            label: '范围模式',
            field: 'range',
            uiType: 'checkbox',
          },
          {
            schema: {
              anyOf: [
                { type: 'number' },
                { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
              ],
            },
            label: '初始值',
            field: 'defaultValue',
            uiType: 'number',
            linkageShow: [
              {
                field: 'range',
                value: false,
              },
            ],
            props: {
              step: 1,
            },
          },
          {
            label: '初始下限',
            field: 'defaultStart',
            uiType: 'number',
            linkageShow: [
              {
                field: 'range',
                value: true,
              },
            ],
            props: {
              step: 1,
            },
          },
          {
            label: '初始上限',
            field: 'defaultEnd',
            uiType: 'number',
            linkageShow: [
              {
                field: 'range',
                value: true,
              },
            ],
            props: {
              step: 1,
            },
          },
          {
            label: '禁用',
            field: 'disabled',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '键盘调整',
            field: 'keyboard',
            uiType: 'checkbox',
          },
          {
            label: '反向',
            field: 'reverse',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '垂直',
            field: 'vertical',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '显示刻度点',
            field: 'dots',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '显示选中区间',
            field: 'included',
            uiType: 'checkbox',
          },
          {
            label: '范围可拖动',
            field: 'draggableTrack',
            uiType: 'checkbox',
            defaultValue: false,
            linkageShow: [
              {
                field: 'range',
                value: true,
              },
            ],
          },
          {
            label: '提示显示',
            field: 'tooltipMode',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '默认',
                  value: 'auto',
                },
                {
                  label: '始终显示',
                  value: 'always',
                },
                {
                  label: '隐藏',
                  value: 'hidden',
                },
              ],
            },
          },
          {
            label: '提示位置',
            field: 'tooltipPlacement',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '上方',
                  value: 'top',
                },
                {
                  label: '下方',
                  value: 'bottom',
                },
                {
                  label: '左侧',
                  value: 'left',
                },
                {
                  label: '右侧',
                  value: 'right',
                },
              ],
            },
            linkageMode: 'any',
            linkageShow: [
              { field: 'tooltipMode', value: 'auto' },
              { field: 'tooltipMode', value: 'always' },
              { field: 'tooltipMode', value: undefined },
            ],
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
