import { lazy } from 'react';
import { defineMaterial } from '@';

const ButtonMaterial = defineMaterial({
  type: 'button',
  layout: { display: 'inline', blockWhen: { prop: 'block', values: ['true'] } },
  title: '按钮',
  defaultProps: { text: '按钮', type: 'default', size: 'medium' },
  context: {
    variables: [
      { name: 'text', description: '文本内容' },
      { name: 'loading', description: '加载中' },
    ],
    writable: [
      { name: 'text', description: '文本内容' },
      { name: 'loading', description: '加载中' },
    ],
    actions: [],
    events: [
      {
        name: 'onClick',
        description: '点击',
        params: [{ description: '业务参数（event.payload）' }],
      },
    ],
  },
  description: '触发提交、重置、跳转或其他页面操作。',
  keywords: ['按钮', '提交', '操作'],
  role: 'action',
  acceptsChildren: false,
  usage: '为表单或页面提供清晰的用户操作入口。',
  constraints: ['仅在配置 href 时使用 target。'],
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '按钮文本',
            field: 'text',
            uiType: 'input',
          },
          {
            label: '按钮类型',
            field: 'type',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '默认',
                  value: 'default',
                },
                {
                  label: '主要',
                  value: 'primary',
                },
                {
                  label: '虚线',
                  value: 'dashed',
                },
                {
                  label: '链接',
                  value: 'link',
                },
                {
                  label: '文本',
                  value: 'text',
                },
              ],
            },
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
            label: '危险样式',
            field: 'danger',
            uiType: 'checkbox',
          },
          {
            label: '撑满宽度',
            field: 'block',
            uiType: 'checkbox',
          },
          {
            label: '透明背景',
            field: 'ghost',
            uiType: 'checkbox',
          },
          {
            label: '跳转地址',
            field: 'href',
            uiType: 'input',
          },
          {
            label: '打开方式',
            field: 'target',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '当前窗口',
                  value: '_self',
                },
                {
                  label: '新窗口',
                  value: '_blank',
                },
              ],
            },
            linkageShow: [
              {
                field: 'href',
                isNotEmpty: true,
              },
            ],
          },
        ],
      },
    ],
  },
});
export default ButtonMaterial;
