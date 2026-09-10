import { describe, expect, it } from 'vitest';
import type { Schema } from '@tangramino/engine';
import { findUnknownMaterialTypes } from './react';

describe('React runtime', () => {
  it('reports each unknown material once', () => {
    const schema = {
      elements: {
        root: { id: 'root', type: 'known', props: {}, children: ['one', 'two'] },
        one: { id: 'one', type: 'unknown', props: {}, children: [] },
        two: { id: 'two', type: 'unknown', props: {}, children: [] },
      },
      root: 'root',
    } as unknown as Schema;
    expect(findUnknownMaterialTypes(schema, { known: () => null })).toEqual(['unknown']);
  });
});
