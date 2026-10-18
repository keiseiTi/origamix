import { lazy } from 'react';
import { defineMaterial } from '@';
import { textareaManifest } from './manifest';

const material = defineMaterial({
  manifest: textareaManifest,
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
            label: '自动高度',
            field: 'autoSize',
            defaultValue: false,
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
                defaultValue: false,
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
        ],
      },
    ],
  },
});

export default material;
