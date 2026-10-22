import { SelectOptionsEditor } from '../../components/collection-editor';
import { lazy } from 'react';
import { defineMaterial } from '@';
import { selectManifest } from './manifest';

const material = defineMaterial({
  manifest: selectManifest,
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          { field: 'options', label: '选项配置', uiType: 'custom', render: SelectOptionsEditor },
          {
            label: '占位符',
            field: 'placeholder',
            uiType: 'input',
          },
          {
            label: '选择模式',
            field: 'mode',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '单选',
                  value: undefined,
                },
                {
                  label: '多选',
                  value: 'multiple',
                },
                {
                  label: '标签',
                  value: 'tags',
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
            label: '允许清除',
            field: 'allowClear',
            uiType: 'checkbox',
          },
          {
            label: '支持搜索',
            field: 'showSearch',
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
            label: '加载中',
            field: 'loading',
            uiType: 'checkbox',
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
            label: '弹层高度',
            field: 'listHeight',
            uiType: 'number',
            props: {
              min: 1,
              step: 1,
            },
          },
          {
            label: '虚拟滚动',
            field: 'virtual',
            defaultValue: true,
            uiType: 'checkbox',
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
