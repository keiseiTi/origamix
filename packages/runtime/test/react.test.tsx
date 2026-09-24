import { describe, expect, it } from 'vitest';
import type { Schema } from '@tangramino/engine';
import { findUnknownMaterialTypes } from '../react';

describe('page preview', () => {
  it('rejects a Schema whose material is unavailable to the renderer', () => {
    const schema = {
      elements: {
        root: { id: 'root', type: 'known', props: {}, children: ['missing'] },
        missing: { id: 'missing', type: 'unknown', props: {}, children: [] },
      },
      root: 'root',
    } as unknown as Schema;
    expect(findUnknownMaterialTypes(schema, { known: () => null })).toContain('unknown');
  });
});
