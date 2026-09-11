import { defineDateInputManifest } from '../manifest-definition';

export const timePickerManifest = defineDateInputManifest('timePicker', '时间选择器', {
  format: { type: 'string', enum: ['HH:mm:ss', 'HH:mm'] },
  placeholder: { type: 'string' },
  allowClear: { type: 'boolean' },
});
