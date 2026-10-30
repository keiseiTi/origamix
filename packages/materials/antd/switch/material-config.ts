import { lazy } from 'react';
import { defineMaterial } from '@';
const material = defineMaterial({
  type: 'switch',
  layout: { display: 'inline' },
  title: '开关',
  defaultProps: {},
  context: {
    variables: [{ name: 'checked', description: '是否选中' }],
    writable: [{ name: 'checked', description: '是否选中' }],
    values: [],
    methods: [
      {
        name: 'onChange',
        description: '值改变',
        params: [{ description: '业务参数（event.payload）' }],
      },
    ],
  },
  description: '录入开启或关闭两种状态。',
  keywords: ['开关', '布尔值', '启用'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  usage: '用于启用、停用等布尔字段。',
  constraints: ['必须置于 form 中。'],
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            label: '初始开启',
            field: 'defaultChecked',
            uiType: 'checkbox',
          },
          {
            label: '禁用',
            field: 'disabled',
            uiType: 'checkbox',
          },
          {
            label: '加载中',
            field: 'loading',
            uiType: 'checkbox',
          },
          {
            schema: { type: 'string', enum: ['medium', 'small'] },
            label: '尺寸',
            field: 'size',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '默认',
                  value: 'default',
                },
                {
                  label: '小',
                  value: 'small',
                },
              ],
            },
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
