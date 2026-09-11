import { defineDateInputManifest } from '../manifest-definition';

export const datePickerRangeManifest = defineDateInputManifest(
  'datePickerRange',
  '日期范围选择器',
  {
    format: { type: 'string' },
    placeholder: { type: 'string' },
    showNow: { type: 'boolean' },
    allowClear: { type: 'boolean' },
  },
);
