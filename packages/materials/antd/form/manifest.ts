import { defineManifest } from '../manifest-definition';

export const formManifest = defineManifest({
  type: 'form',
  title: '表单容器',
  defaultProps: {
    layout: 'horizontal',
    labelAlign: 'right',
    colon: true,
    preserve: true,
    requiredMark: true,
    initialValues: {},
  },
  context: {
    variables: [
      {
        name: 'value',
        description: '表单值',
      },
      {
        name: 'disabled',
        description: '是否禁用',
      },
    ],
    values: [
      {
        name: 'value',
        description: '表单值',
      },
      {
        name: 'validateFields',
        description: '表单校验',
        isMethod: true,
      },
      {
        name: 'resetFields',
        description: '表单重置',
        isMethod: true,
      },
    ],
    methods: [],
  },
  description: '表单容器的结构与展示属性。',
  keywords: ['表单容器', 'layout'],
  role: 'layout',
  acceptsChildren: true,
  allowedParentTypes: ['basicPage', 'container', 'tabs', 'modal', 'drawer'],
  propsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      name: {
        type: 'string',
      },
      layout: {
        type: 'string',
        enum: ['horizontal', 'vertical', 'inline'],
      },
      size: {
        type: 'string',
        enum: ['large', 'middle', 'small'],
      },
      labelAlign: {
        type: 'string',
        enum: ['left', 'right'],
      },
      labelColVal: {
        type: 'integer',
        minimum: 0,
        maximum: 24,
      },
      wrapperColVal: {
        type: 'integer',
        minimum: 0,
        maximum: 24,
      },
      labelWrap: {
        type: 'boolean',
      },
      colon: {
        type: 'boolean',
      },
      disabled: {
        type: 'boolean',
      },
      preserve: {
        type: 'boolean',
      },
      requiredMark: {
        anyOf: [
          {
            type: 'boolean',
          },
          {
            type: 'string',
            enum: ['optional'],
          },
        ],
      },
      scrollToFirstError: {
        type: 'boolean',
      },
      validateTrigger: {
        type: 'string',
        enum: ['onChange', 'onBlur'],
      },
      variant: {
        type: 'string',
        enum: ['outlined', 'borderless', 'filled', 'underlined'],
      },
      initialValues: {
        type: 'object',
      },
      clearOnDestroy: {
        type: 'boolean',
      },
    },
  },
  usage: '配置表单容器的属性与展示行为。',
  constraints: ['不将实例或回调写入 Schema。'],
});
