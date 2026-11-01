import { OptionsEditor } from '../../components/collection-editor';
import { lazy } from 'react';
import { defineMaterial } from '@';
const material = defineMaterial({
  formField: true,
  type: 'checkbox',
  layout: { display: 'inline' },
  title: '复选框',
  defaultProps: {
    options: [
      { label: '选项1', value: '选项1' },
      { label: '选项2', value: '选项2' },
    ],
  },
  context: {
    variables: [{ name: 'value', description: '当前值' }],
    writable: [{ name: 'value', description: '当前值' }],
    actions: [],
    events: [
      {
        name: 'onChange',
        description: '值改变',
        params: [{ description: '业务参数（event.payload）' }],
      },
    ],
  },
  description: '从一组选项中选择零个或多个值。',
  keywords: ['复选框', '多选', '选项'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  usage: '用于多选字段。',
  constraints: ['必须置于 form 中。'],
  Component: lazy(() => import('./index')),
  editorConfig: {
    panels: [
      {
        title: '属性',
        configs: [
          {
            schema: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  label: { type: 'string' },
                  value: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
                  disabled: { type: 'boolean' },
                },
                required: ['label', 'value'],
              },
            },
            field: 'options',
            label: '选项配置',
            uiType: 'custom',
            render: OptionsEditor,
            resetOnValueChange: false,
          },
          {
            label: '禁用',
            field: 'disabled',
            uiType: 'checkbox',
          },
        ],
      },
    ],
  },
});
export default material;
