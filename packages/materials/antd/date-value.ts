import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(customParseFormat);

/** Persisted dates stay strings; Dayjs objects exist only in the rendering adapter. */
export const parseDateValue = (value: Dayjs | string | null | undefined): Dayjs | undefined => {
  if (!value) return undefined;
  if (dayjs.isDayjs(value)) return value;
  const parsed = dayjs(value, ['YYYY-MM-DD', 'YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DDTHH:mm:ss'], true);
  return parsed.isValid() ? parsed : undefined;
};

export const parseTimeValue = (value: Dayjs | string | null | undefined): Dayjs | undefined => {
  if (!value) return undefined;
  if (dayjs.isDayjs(value)) return value;
  const parsed = dayjs(value, ['HH:mm:ss', 'HH:mm'], true);
  return parsed.isValid() ? parsed : undefined;
};
