import { defineOrigamixMaterial } from '../../src/origamix-material';
import { objectSchema } from '../manifest-definition';

export const inputDefinition = defineOrigamixMaterial({
  type: 'input',
  title: '输入框',
  defaultProps: { placeholder: '请输入内容' },
  context: {
    variables: [
      { name: 'value', description: '当前值' },
      { name: 'disabled', description: '是否禁用' },
    ],
    values: [],
    methods: [
      { name: 'onChange', description: '值改变时的回调', params: [{ description: '事件参数' }] },
      { name: 'onPressEnter', description: '回车的回调', params: [{ description: '事件参数' }] },
    ],
  },
  metadata: {
    version: '1.0.0',
    description: '录入单行文本。',
    keywords: ['输入框', '文本', '字段'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    documentationUrl: 'https://ant.design/components/input/#api',
    propsSchema: objectSchema({
      defaultValue: { type: 'string' },
      size: { type: 'string', enum: ['large', 'middle', 'small'] },
      disabled: { type: 'boolean' },
      readOnly: { type: 'boolean' },
      status: { type: 'string', enum: ['error', 'warning'] },
      variant: { type: 'string', enum: ['outlined', 'borderless', 'filled', 'underlined'] },
      prefix: { type: 'string' },
      suffix: { type: 'string' },
      autoComplete: { type: 'string', enum: ['on', 'off'] },
      type: { type: 'string', enum: ['text', 'password', 'email', 'tel', 'url'] },
      maxLength: { type: 'number', minimum: 0, maximum: 1000 },
      addonBefore: { type: 'string' },
      addonAfter: { type: 'string' },
      placeholder: { type: 'string' },
      allowClear: { type: 'boolean' },
      showCount: { type: 'boolean' },
    }),
    usage: '用于姓名、标题、账号、邮箱或密码等单行字段；密码字段使用 type=password。',
    constraints: ['必须置于 form 中。'],
  },
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
            label: '输入类型',
            field: 'type',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '文本',
                  value: 'text',
                },
                {
                  label: '密码',
                  value: 'password',
                },
                {
                  label: '邮箱',
                  value: 'email',
                },
                {
                  label: '电话',
                  value: 'tel',
                },
                {
                  label: '网址',
                  value: 'url',
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
            label: '前缀文字',
            field: 'prefix',
            uiType: 'input',
          },
          {
            label: '后缀文字',
            field: 'suffix',
            uiType: 'input',
          },
          {
            label: '自动填充',
            field: 'autoComplete',
            uiType: 'select',
            props: {
              options: [
                {
                  label: '默认',
                  value: undefined,
                },
                {
                  label: '开启',
                  value: 'on',
                },
                {
                  label: '关闭',
                  value: 'off',
                },
              ],
            },
          },
        ],
      },
    ],
  },
});
