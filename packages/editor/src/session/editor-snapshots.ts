import type { EditorReadonly } from '../interfaces/editor-operation-interfaces';

/** Clone data before freezing so callers never freeze or mutate the session's objects. */
export const editorSnapshot = <T>(value: T): EditorReadonly<T> => {
  const seen = new WeakMap<object, object>();
  const copy = (input: unknown): unknown => {
    if (!input || typeof input !== 'object') return input;
    // React elements and component registrations retain their framework-owned identity.
    if ('$$typeof' in input && typeof input.$$typeof === 'symbol') return input;
    if (seen.has(input)) return seen.get(input);
    const output: Record<string, unknown> | unknown[] = Array.isArray(input) ? [] : {};
    seen.set(input, output);
    for (const [key, child] of Object.entries(input))
      Object.defineProperty(output, key, {
        value: copy(child),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    return Object.freeze(output);
  };
  return copy(value) as EditorReadonly<T>;
};
