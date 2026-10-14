import { defineSimpleManifest, objectSchema, inputContext } from '../manifest-definition';
export const datePickerManifest = defineSimpleManifest(
  {
    type: 'datePicker',
    title: '日期选择器',
    defaultProps: { picker: 'date', allowClear: true },
    context: inputContext,
  },
  {
    description: '日期选择器属性配置。',
    keywords: ['日期选择器'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    propsSchema: objectSchema({
      picker: {
        type: 'string',
        enum: ['date', 'week', 'month', 'quarter', 'year'],
      },
      format: {
        type: 'string',
      },
      placeholder: {
        type: 'string',
      },
      defaultValue: {
        type: 'string',
      },
      showTime: {
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
      minDate: {
        type: 'string',
      },
      maxDate: {
        type: 'string',
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
    usage: '用于表单中的日期选择器。',
    constraints: ['必须置于 form 中。'],
  },
);
