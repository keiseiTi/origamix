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
    propsSchema: objectSchema({
      type: { type: 'string', enum: ['text', 'password', 'email'] },
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
            label: '输入类型',
            field: 'type',
            uiType: 'select',
            props: {
              options: [
                { label: '文本', value: 'text' },
                { label: '密码', value: 'password' },
                { label: '邮箱', value: 'email' },
              ],
            },
          },
          {
            label: '最大长度',
            field: 'maxLength',
            uiType: 'number',
            props: { min: 0, max: 1000, step: 1 },
          },
          { label: '前置标签', field: 'addonBefore', uiType: 'input', props: {} },
          { label: '后置标签', field: 'addonAfter', uiType: 'input', props: {} },
          {
            label: '占位符',
            field: 'placeholder',
            uiType: 'input',
            props: { placeholder: '请输入占位符文本' },
          },
          { label: '允许清除', field: 'allowClear', uiType: 'checkbox' },
          { label: '显示字数', field: 'showCount', uiType: 'checkbox' },
        ],
      },
    ],
  },
});
