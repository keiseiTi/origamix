import { describe, expect, it } from 'vitest';
import { ORIGAMIX_VERSION, type OrigamixPageSchema } from '@origamix/shared';
import { createEditorSession } from '../../src/session/editor-session';
import { SchemaUtils } from '../../src/schema/schema-utils';

const document = (): OrigamixPageSchema => ({
  elements: {
    root: { type: 'container', props: {} },
    button: { type: 'button', props: { text: 'before' } },
  },
  layout: { root: 'root', structure: { root: ['button'] } },
  flows: {
    click: {
      startId: 'start',
      nodes: { start: { id: 'start', type: 'start', props: {}, prev: [], next: [] } },
    },
  },
  bindElements: [{ id: 'button', event: 'onClick', flowId: 'click' }],
  context: { globalVariables: [] },
  extensions: {
    origamix: { schemaVersion: ORIGAMIX_VERSION },
    flowGraph: { 'button::onClick': { nodes: [] } },
  },
});

describe('editor draft sessions', () => {
  // Server cannot prove browser-owned history, isolation or rejected local draft retention.
  it('isolates pages and restores the full document across deletion, undo and rejected edits', () => {
    const initial = document();
    const materials = ['container', 'button'].map((type) => ({
      type,
      title: type,
      Component: () => null,
    }));
    const first = createEditorSession(initial, materials),
      second = createEditorSession(document(), materials);
    const removed = SchemaUtils.removeElement(initial, 'button').schema;
    first.getState().setSchema(removed);
    expect(first.getState().schema.bindElements).toEqual([]);
    expect(first.getState().schema.flows).toEqual({});
    expect(first.getState().schema.extensions.flowGraph).toEqual({});
    first.getState().undo();
    expect(first.getState().schema).toEqual(initial);
    expect(first.getState().canRedo).toBe(true);
    const invalid = { ...initial, layout: { ...initial.layout, structure: { root: ['missing'] } } };
    expect(() => first.getState().setSchema(invalid)).toThrow('草稿已保留');
    expect(() =>
      first.getState().setSchema({
        ...initial,
        layout: { ...initial.layout, structure: { root: ['button', 'button'] } },
      }),
    ).toThrow('草稿已保留');
    expect(() =>
      first.getState().setSchema({
        ...initial,
        elements: { ...initial.elements, button: { type: 'unknown', props: {} } },
      }),
    ).toThrow('草稿已保留');
    expect(first.getState().schema).toBe(initial);
    expect(first.getState().canRedo).toBe(true);
    const changed = {
      ...initial,
      context: { globalVariables: [{ name: 'count', type: 'number', defaultValue: 1 }] },
    };
    first.getState().setSchema(changed);
    expect(first.getState().canRedo).toBe(false);
    first.getState().undo();
    expect(first.getState().schema).toEqual(initial);
    first.getState().redo();
    expect(first.getState().schema).toEqual(changed);
    expect(second.getState().schema).toEqual(initial);
    expect(second.getState().canUndo).toBe(false);
  });
});
