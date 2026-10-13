import { defineSimpleManifest, objectSchema, inputContext } from '../manifest-definition';
export const datePickerRangeManifest = defineSimpleManifest(
  {
    type: 'datePickerRange',
    title: '日期范围选择器',
    defaultProps: { picker: 'date', allowClear: true },
    context: inputContext,
  },
  {
    description: '日期范围选择器属性配置。',
    keywords: ['日期范围选择器'],
    role: 'input',
    acceptsChildren: false,
    allowedParentTypes: ['form'],
    documentationUrl: 'https://ant.design/components/date-picker/#api',
    propsSchema: objectSchema({
      picker: {
        type: 'string',
        enum: ['date', 'week', 'month', 'quarter', 'year'],
      },
      format: {
        type: 'string',
      },
      startPlaceholder: {
        type: 'string',
      },
      endPlaceholder: {
        type: 'string',
      },
      defaultStart: {
        type: 'string',
      },
      defaultEnd: {
        type: 'string',
      },
      showTime: {
        type: 'boolean',
      },
      allowEmptyStart: {
        type: 'boolean',
      },
      allowEmptyEnd: {
        type: 'boolean',
      },
      inputReadOnly: {
        type: 'boolean',
      },
      needConfirm: {
        type: 'boolean',
      },
      order: {
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
      placeholder: {
        anyOf: [
          {
            type: 'string',
          },
          {
            type: 'array',
            items: {
              type: 'string',
            },
            minItems: 2,
            maxItems: 2,
          },
        ],
      },
      showNow: {
        type: 'boolean',
      },
    }),
    usage: '用于表单中的日期范围选择器。',
    constraints: ['必须置于 form 中。'],
  },
);
