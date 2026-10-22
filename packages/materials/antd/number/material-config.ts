import { lazy } from 'react';
import { defineMaterial } from '@';
import { numberManifest } from './manifest';
const material = defineMaterial({
  manifest: numberManifest,
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '初始值',
            field: 'defaultValue',
            uiType: 'number',
          },
          {
            label: '最小值',
            field: 'min',
            uiType: 'number',
          },
          {
            label: '最大值',
            field: 'max',
            uiType: 'number',
          },
          {
            label: '步长',
            field: 'step',
            uiType: 'number',
            props: {
              min: 0,
              step: 0.1,
            },
          },
          {
            label: '精度',
            field: 'precision',
            uiType: 'number',
            props: {
              min: 0,
              max: 10,
              step: 1,
            },
          },
          {
            label: '占位符',
            field: 'placeholder',
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
          },
          {
            label: '只读',
            field: 'readOnly',
            uiType: 'checkbox',
          },
          {
            label: '显示增减按钮',
            field: 'controls',
            defaultValue: true,
            uiType: 'checkbox',
          },
          {
            label: '键盘调整',
            field: 'keyboard',
            defaultValue: true,
            uiType: 'checkbox',
          },
          {
            label: '滚轮调整',
            field: 'changeOnWheel',
            uiType: 'checkbox',
          },
          {
            label: '失焦时校正',
            field: 'changeOnBlur',
            defaultValue: true,
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
            label: '小数分隔符',
            field: 'decimalSeparator',
            uiType: 'input',
          },
        ],
      },
    ],
  },
});
export default material;
