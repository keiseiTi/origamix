import { OptionsEditor } from '../../components/collection-editor';
import { lazy } from 'react';
import { defineMaterial } from '@';
const material = defineMaterial({
  type: 'radio',
  layout: { display: 'inline' },
  title: '单选框',
  defaultProps: {
    options: [
      { label: '选项一', value: 'option1' },
      { label: '选项二', value: 'option2' },
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
  description: '从一组选项中选择一个值。',
  keywords: ['单选框', '单选', '选项'],
  role: 'input',
  acceptsChildren: false,
  allowedParentTypes: ['form'],
  usage: '用于互斥选择字段。',
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
          },
          {
            label: '禁用',
            field: 'disabled',
            uiType: 'checkbox',
          },
          {
            label: '表单字段名',
            field: 'name',
            uiType: 'input',
          },
          {
            label: '选项样式',
            field: 'optionType',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '单选框',
                  value: 'default',
                },
                {
                  label: '按钮',
                  value: 'button',
                },
              ],
            },
          },
          {
            label: '按钮风格',
            field: 'buttonStyle',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '描边',
                  value: 'outline',
                },
                {
                  label: '填充',
                  value: 'solid',
                },
              ],
            },
            linkageShow: [
              {
                field: 'optionType',
                value: 'button',
              },
            ],
          },
          {
            label: '按钮尺寸',
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
            linkageShow: [
              {
                field: 'optionType',
                value: 'button',
              },
            ],
          },
          {
            label: '撑满宽度',
            field: 'block',
            uiType: 'checkbox',
          },
          {
            label: '排列方向',
            field: 'orientation',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '横向',
                  value: 'horizontal',
                },
                {
                  label: '纵向',
                  value: 'vertical',
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
