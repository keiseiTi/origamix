import { lazy } from 'react';
import { defineMaterial } from '@';
import { cascaderManifest } from './manifest';

const material = defineMaterial({
  manifest: cascaderManifest,
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
            defaultValue: false,
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
            label: '禁用',
            field: 'disabled',
            uiType: 'checkbox',
            defaultValue: false,
          },
          {
            label: '允许清除',
            field: 'allowClear',
            uiType: 'checkbox',
            defaultValue: true,
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
        ],
      },
    ],
  },
});
export default material;
