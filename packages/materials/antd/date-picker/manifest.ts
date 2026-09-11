import { defineDateInputManifest } from '../manifest-definition';

export const datePickerManifest = defineDateInputManifest('datePicker', '日期选择器', {
  format: { type: 'string' },
  picker: { type: 'string', enum: ['date', 'week', 'month', 'quarter', 'year'] },
  placeholder: { type: 'string' },
  allowClear: { type: 'boolean' },
});
