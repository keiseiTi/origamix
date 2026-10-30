import { lazy } from 'react';
import { defineMaterial } from '@';
const FloatButtonMaterial = defineMaterial({
  type: 'floatButton',
  layout: { display: 'inline' },
  title: '悬浮按钮',
  defaultProps: { type: 'default', shape: 'circle' },
  context: { variables: [], writable: [], values: [], methods: [] },
  description: '悬浮在页面边缘的快捷操作按钮。',
  keywords: ['悬浮按钮', '快捷操作'],
  role: 'action',
  acceptsChildren: false,
  usage: '为页面提供悬浮的快捷操作入口。',
  constraints: [],
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '按钮类型',
            field: 'type',
            uiType: 'select',
            props: {
              options: [
                { label: '默认', value: 'default' },
                { label: '主要', value: 'primary' },
              ],
            },
          },
          {
            label: '按钮形状',
            field: 'shape',
            uiType: 'radio',
            props: {
              options: [
                { label: '圆形', value: 'circle' },
                { label: '方形', value: 'square' },
              ],
            },
          },
          {
            label: '禁用',
            field: 'disabled',
            uiType: 'checkbox',
          },
          { field: 'href', hidden: true, schema: { type: 'string' }, uiType: 'input' },
          {
            field: 'target',
            hidden: true,
            schema: { type: 'string', enum: ['_self', '_blank'] },
            uiType: 'input',
          },
          {
            field: 'htmlType',
            hidden: true,
            schema: { type: 'string', enum: ['button', 'submit', 'reset'] },
            uiType: 'input',
          },
        ],
      },
    ],
  },
});
export default FloatButtonMaterial;
