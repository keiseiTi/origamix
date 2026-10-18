import { lazy } from 'react';
import { defineMaterial } from '@';
import { formManifest } from './manifest';
import { validateRecord } from '../structured-data-validation';

const material = defineMaterial({
  manifest: formManifest,
  Component: lazy(() => import('./index')),
  isContainer: true,
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
                  value: 'middle',
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
            defaultValue: true,
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
            defaultValue: true,
          },
          {
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
            field: 'initialValues',
            validateValue: validateRecord,
            label: '初始字段值',
            uiType: 'json',
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
