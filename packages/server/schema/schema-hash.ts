import { createHash } from 'node:crypto';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';

export const hashSchema = (schema: OrigamixPageSchema): string => {
  const normalize = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(normalize)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([key, item]) => [key, normalize(item)]),
          )
        : value;
  return createHash('sha256')
    .update(JSON.stringify(normalize(schema)))
    .digest('hex');
};
export const hashValue = (value: unknown): string => {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
};
