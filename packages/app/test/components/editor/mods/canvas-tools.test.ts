import type { Schema } from '@tangramino/engine';
import { describe, expect, it } from 'vitest';
import { removeEditorElement } from '../../../../src/components/editor/mods/editor-schema';

describe('editor canvas tools', () => {
  it('passes the updated schema—not the removal result envelope—back to the editor', () => {
    const schema: Schema = {
      elements: {
        root: { type: 'container', props: {} },
        child: { type: 'button', props: { text: '删除我' } },
      },
      layout: {
        root: 'root',
        structure: { root: ['child'] },
      },
      extensions: {},
    };

    const next = removeEditorElement(schema, 'child');

    expect(next.elements.child).toBeUndefined();
    expect(next.layout.structure.root).toEqual([]);
    expect(next).not.toHaveProperty('schema');
    expect(next).not.toHaveProperty('operation');
  });
});
