import type { JsonSchema } from '@origamix/shared';
import { objectSchema } from './manifest-definition';

/** Recursive JSON-only data, without callbacks or component references. */
export const hierarchicalOptionsSchema = (
  field: 'options' | 'treeData',
  properties: Readonly<Record<string, JsonSchema>>,
): JsonSchema => ({
  ...objectSchema({ ...properties, [field]: { type: 'array', items: { $ref: '#/$defs/option' } } }),
  $defs: {
    option: objectSchema(
      {
        value: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
        ...(field === 'options'
          ? { label: { type: 'string' } }
          : {
              title: { type: 'string' },
              key: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
            }),
        disabled: { type: 'boolean' },
        isLeaf: { type: 'boolean' },
        ...(field === 'treeData'
          ? {
              selectable: { type: 'boolean' },
              disableCheckbox: { type: 'boolean' },
              checkable: { type: 'boolean' },
            }
          : {}),
        children: { type: 'array', items: { $ref: '#/$defs/option' } },
      },
      ['value', field === 'options' ? 'label' : 'title'],
    ),
  },
});
