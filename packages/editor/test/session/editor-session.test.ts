import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type OrigamixPageSchema } from '@origamix/shared';
import { createEditorSession } from '../../src/session/editor-session';
import { bindEditorSession, createEditorInstance } from '../../src/session/editor-controls';
import type { EditorInstance } from '../../src/session/editor-controls';
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
    origamix: { schemaVersion: SCHEMA_VERSION },
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
  // New public instance commands must not mutate a detached/read-only session or cross an async flush boundary.
  it('guards public commands and rejects a mode switch that outlives its draft session', async () => {
    const initial = document();
    const first = createEditorSession(initial, []);
    const second = createEditorSession(document(), []);
    let resolveFlush = (): void => undefined;
    const pendingFlush = new Promise<void>((resolve) => {
      resolveFlush = resolve;
    });
    const editor = createEditorInstance({ beforeModeChange: () => pendingFlush });
    const detach = bindEditorSession(editor, first, false);
    const changed = {
      ...initial,
      context: { globalVariables: [{ name: 'count', type: 'number', defaultValue: 1 }] },
    };
    editor.setSchema(changed);
    editor.undo();
    expect(first.getState().schema).toEqual(initial);
    editor.redo();
    expect(first.getState().schema).toEqual(changed);
    const switching = editor.setMode('logic');
    detach();
    expect(() => editor.setSchema(initial)).toThrow('unavailable');
    const detachSecond = bindEditorSession(editor, second, true);
    expect(() => editor.setSchema(changed)).toThrow('不可编辑');
    expect(() => editor.undo()).toThrow('不可编辑');
    resolveFlush();
    await expect(switching).rejects.toThrow('会话已切换');
    expect(first.getState().schema).toEqual(changed);
    expect(second.getState().schema).toEqual(initial);
    detachSecond();
  });
  // Visibility is browser-owned state and must never become a Working edit or undo step.
  it('keeps overlay selection and closing outside schema history', () => {
    const initial = document();
    initial.elements.layer = { type: 'modal', props: { open: false } };
    initial.layout.structure = { root: ['layer'], layer: ['button'] };
    const overlay = {
      type: 'modal',
      title: 'modal',
      Component: () => null,
      editorConfig: { presentation: 'overlay' as const },
    };
    const button = { type: 'button', title: 'button', Component: () => null };
    const store = createEditorSession(initial, [
      overlay,
      button,
      {
        type: 'container',
        title: 'container',
        Component: () => null,
      },
    ]);
    const selected = { id: 'button', ...initial.elements.button!, material: button };
    store.getState().setActiveElement(selected);
    expect(store.getState().openOverlayIds).toEqual(['layer']);
    store.getState().closeOverlay('layer');
    expect(store.getState().openOverlayIds).toEqual([]);
    store.getState().setActiveElement(selected);
    expect(store.getState().openOverlayIds).toEqual(['layer']);
    expect(store.getState().schema).toBe(initial);
    expect(store.getState().canUndo).toBe(false);
    store.getState().setSchema(SchemaUtils.removeElement(initial, 'layer').schema);
    expect(store.getState().openOverlayIds).toEqual([]);
    store.getState().undo();
    expect(store.getState().schema).toEqual(initial);
    expect(store.getState().schema.elements.layer!.props.open).toBe(false);
  });
});

// Plugin-held commands must never mutate a subsequently bound page.
describe('plugin session isolation', () => {
  it('starts right-to-left and invalidates old commands before reverse cleanup', () => {
    const calls: string[] = [];
    const captured: EditorInstance[] = [];
    const editor = createEditorInstance({
      plugins: ['A', 'B', 'C'].map((id) => ({
        id,
        setup: ({ editor: scoped, signal }) => {
          calls.push(id);
          captured.push(scoped);
          return () => {
            expect(signal.aborted).toBe(true);
            expect(() => scoped.setSchema(document())).toThrow('unavailable');
            calls.push(`dispose:${id}`);
          };
        },
      })),
    });
    const detach = bindEditorSession(editor, createEditorSession(document(), []), false);
    detach();
    expect(calls).toEqual(['C', 'B', 'A', 'dispose:A', 'dispose:B', 'dispose:C']);
    const second = createEditorSession(document(), []);
    const detachSecond = bindEditorSession(editor, second, false);
    expect(() => captured[0]!.setSchema(document())).toThrow('unavailable');
    expect(second.getState().canUndo).toBe(false);
    detachSecond();
  });

  it('aborts partial setup and releases the binding after initialization fails', () => {
    let signal: AbortSignal | undefined;
    let stale: EditorInstance | undefined;
    const editor = createEditorInstance({
      plugins: [
        {
          id: 'broken',
          setup: (context) => {
            signal = context.signal;
            stale = context.editor;
            throw new Error('setup failed');
          },
        },
      ],
    });
    expect(() => bindEditorSession(editor, createEditorSession(document(), []), false)).toThrow(
      'broken',
    );
    expect(signal?.aborted).toBe(true);
    expect(() => stale!.setSchema(document())).toThrow('unavailable');
    expect(() => editor.setSchema(document())).toThrow('unavailable');
  });
});
