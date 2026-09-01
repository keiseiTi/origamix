import React from 'react';

const Text = React.lazy(() => import('./index'));
import type { Material } from '../interfaces/material';

const TextMaterial: Material = {
  Component: Text,
  title: '文本',
  type: 'text',
  defaultProps: {
    text: '文本',
  },
  contextConfig: {
    variables: [
      {
        name: 'text',
        description: '文本内容',
      },
      {
        name: 'type',
        description: '文本类型',
      },
      {
        name: 'copyable',
        description: '是否可复制',
      },
      {
        name: 'editable',
        description: '是否可编辑',
      },
      {
        name: 'underline',
        description: '是否下划线',
      },
      {
        name: 'strong',
        description: '是否加粗',
      },
      {
        name: 'italic',
        description: '是否斜体',
      },
      {
        name: 'textType',
        description: '文本类型',
      },
      {
        name: 'ellipsis',
        description: '是否省略号',
      },
      {
        name: 'code',
        description: '是否代码样式',
      },
      {
        name: 'mark',
        description: '是否标记样式',
      },
    ],
    methods: [
      {
        name: 'onClick',
        description: '点击文本时触发',
      },
    ],
  },
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '内容',
            field: 'text',
            uiType: 'input',
          },
          {
            label: '类型',
            field: 'type',
            uiType: 'select',
            props: {
              allowClear: true,
              options: [
                { label: '文本', value: 'text' },
                { label: '段落', value: 'paragraph' },
                { label: '标题 H1', value: 'h1' },
                { label: '标题 H2', value: 'h2' },
                { label: '标题 H3', value: 'h3' },
                { label: '标题 H4', value: 'h4' },
                { label: '标题 H5', value: 'h5' },
              ],
            },
          },
          {
            label: '文本类型',
            field: 'textType',
            uiType: 'select',
            props: {
              allowClear: true,
              options: [
                { label: '默认', value: undefined },
                { label: '次级', value: 'secondary' },
                { label: '成功', value: 'success' },
                { label: '警告', value: 'warning' },
                { label: '危险', value: 'danger' },
              ],
            },
          },
          {
            label: '省略行数',
            field: 'ellipsis',
            uiType: 'checkbox',
          },
          {
            label: '可复制',
            field: 'copyable',
            uiType: 'checkbox',
          },
          {
            label: '可编辑',
            field: 'editable',
            uiType: 'checkbox',
          },
          {
            label: '下划线',
            field: 'underline',
            uiType: 'checkbox',
          },
          {
            label: '加粗',
            field: 'strong',
            uiType: 'checkbox',
          },
          {
            label: '斜体',
            field: 'italic',
            uiType: 'checkbox',
          },
          {
            label: '代码样式',
            field: 'code',
            uiType: 'checkbox',
          },
          {
            label: '标记样式',
            field: 'mark',
            uiType: 'checkbox',
          },
        ],
      },
    ],
  },
};

export default TextMaterial;
