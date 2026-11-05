import { createHash } from 'node:crypto';

/** Object-key order is irrelevant; array order remains significant. JSON values only. */
export const hashJson = (value: unknown): string => {
  const normalize = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(normalize)
      : item && typeof item === 'object'
        ? Object.fromEntries(
            Object.entries(item as Record<string, unknown>)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([key, nested]) => [key, normalize(nested)]),
          )
        : item;
  return createHash('sha256')
    .update(JSON.stringify(normalize(value)))
    .digest('hex');
};
