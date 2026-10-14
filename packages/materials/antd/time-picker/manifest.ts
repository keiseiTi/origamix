import { defineSimpleManifest, objectSchema, inputContext } from '../manifest-definition';
export const timePickerManifest = defineSimpleManifest(
  {
    type: 'timePicker',
    title: '时间选择器',
    defaultProps: { allowClear: true },
    context: inputContext,
  },
  {
    description: '时间选择器属性配置。',
    keywords: ['时间选择器'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({
      format: {
        type: 'string',
        enum: ['HH:mm:ss', 'HH:mm', 'hh:mm:ss A'],
      },
      placeholder: {
        type: 'string',
      },
      defaultValue: {
        type: 'string',
      },
      use12Hours: {
        type: 'boolean',
      },
      hourStep: {
        type: 'integer',
        minimum: 1,
        maximum: 23,
      },
      minuteStep: {
        type: 'integer',
        minimum: 1,
        maximum: 59,
      },
      secondStep: {
        type: 'integer',
        minimum: 1,
        maximum: 59,
      },
      hideDisabledOptions: {
        type: 'boolean',
      },
      showNow: {
        type: 'boolean',
      },
      inputReadOnly: {
        type: 'boolean',
      },
      needConfirm: {
        type: 'boolean',
      },
      size: {
        type: 'string',
        enum: ['large', 'middle', 'small'],
      },
      disabled: {
        type: 'boolean',
      },
      allowClear: {
        type: 'boolean',
      },
      status: {
        type: 'string',
        enum: ['error', 'warning'],
      },
      variant: {
        type: 'string',
        enum: ['outlined', 'filled', 'borderless', 'underlined'],
      },
      placement: {
        type: 'string',
        enum: ['bottomLeft', 'bottomRight', 'topLeft', 'topRight'],
      },
    }),
    usage: '用于表单中的时间选择器。',
    constraints: ['必须置于 form 中。'],
  },
);
