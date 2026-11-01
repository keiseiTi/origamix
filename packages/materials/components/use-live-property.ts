import { useState } from 'react';

/** Keep incomplete input local; publish valid values without an extra submit step. */
export const useLiveProperty = <T>(
  value: unknown,
  read: (value: unknown) => T,
  validate: (value: T) => string | undefined,
  onChange?: (value: unknown) => void,
) => {
  const [pending, setPending] = useState<{ base: unknown; draft: T; error?: string }>();
  const current = pending?.base === value ? pending : undefined;
  return {
    draft: current ? current.draft : read(value),
    error: current?.error,
    change: (next: T) => {
      const error = validate(next);
      setPending({ base: value, draft: next, error });
      if (!error) onChange?.(next);
    },
  };
};
