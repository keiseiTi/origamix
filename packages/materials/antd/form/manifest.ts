import { defineManifest, objectSchema } from '../manifest-definition';

export const formManifest = defineManifest(
  {
    type: 'form',
    title: '表单容器',
    defaultProps: { layout: 'horizontal' },
    context: {
      variables: [
        { name: 'value', description: '表单值' },
        { name: 'disabled', description: '是否禁用' },
      ],
      values: [
        { name: 'value', description: '表单值' },
        { name: 'validateFields', description: '表单校验', isMethod: true },
        { name: 'resetFields', description: '表单重置', isMethod: true },
      ],
      methods: [],
    },
  },
  {
    version: '1.0.0',
    description: '组织输入控件并提供表单值、校验和重置能力。',
    keywords: ['表单', '录入', '校验'],
    role: 'layout',
    acceptsChildren: true,
    allowedParentTypes: ['basicPage', 'container'],
    propsSchema: objectSchema({
      layout: { type: 'string', enum: ['horizontal', 'vertical', 'inline'] },
      size: { type: 'string', enum: ['large', 'middle', 'small'] },
      labelAlign: { type: 'string', enum: ['left', 'right'] },
      labelColVal: { type: 'number', minimum: 0, maximum: 24 },
      wrapperColVal: { type: 'number', minimum: 0, maximum: 24 },
      scrollToFirstError: { type: 'boolean' },
    }),
    usage: '作为输入类物料的父级，配置整体布局与校验行为。',
    constraints: ['输入类子元素应放入表单容器。'],
  },
);
