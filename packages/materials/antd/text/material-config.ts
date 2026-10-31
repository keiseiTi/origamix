import { lazy } from 'react';
import { defineMaterial } from '@';
const material = defineMaterial({
  type: 'text',
  layout: {
    display: 'inline',
    blockWhen: { prop: 'type', values: ['paragraph', 'h1', 'h2', 'h3', 'h4', 'h5'] },
  },
  title: '文本',
  defaultProps: { text: '文本' },
  context: {
    variables: [{ name: 'text', description: '文本内容' }],
    writable: [{ name: 'text', description: '文本内容' }],
    actions: [],
    events: [
      {
        name: 'onClick',
        description: '点击',
        params: [{ description: '业务参数（event.payload）' }],
      },
    ],
  },
  description: '显示标题、段落或普通文本。',
  keywords: ['文本', '标题', '段落'],
  role: 'display',
  acceptsChildren: false,
  usage: '用于页面标题、说明和静态文本。',
  constraints: [],
  Component: lazy(() => import('./index')),
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
              options: [
                {
                  label: '文本',
                  value: 'text',
                },
                {
                  label: '段落',
                  value: 'paragraph',
                },
                {
                  label: '标题 H1',
                  value: 'h1',
                },
                {
                  label: '标题 H2',
                  value: 'h2',
                },
                {
                  label: '标题 H3',
                  value: 'h3',
                },
                {
                  label: '标题 H4',
                  value: 'h4',
                },
                {
                  label: '标题 H5',
                  value: 'h5',
                },
              ],
            },
          },
          {
            label: '文本颜色',
            field: 'textType',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '默认',
                  value: undefined,
                },
                {
                  label: '次级',
                  value: 'secondary',
                },
                {
                  label: '成功',
                  value: 'success',
                },
                {
                  label: '警告',
                  value: 'warning',
                },
                {
                  label: '危险',
                  value: 'danger',
                },
              ],
            },
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
            label: '下划线',
            field: 'underline',
            uiType: 'checkbox',
          },
          {
            label: '删除线',
            field: 'delete',
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
          {
            label: '禁用样式',
            field: 'disabled',
            uiType: 'checkbox',
          },
          {
            label: '可复制',
            field: 'copyable',
            uiType: 'checkbox',
          },
          {
            label: '超出省略',
            field: 'ellipsis',
            uiType: 'checkbox',
          },
        ],
      },
    ],
  },
});
export default material;
