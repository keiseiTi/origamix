import type { EditorEvents } from '../../src/contracts/editor-operation-contracts';
import { describe, expect, it, vi } from 'vitest';
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
    let initializationError: unknown;
    const edits = vi.fn();
    const store = createEditorSession(document(), []);
    const editor = createEditorInstance({
      plugins: [
        {
          id: 'broken',
          setup: (context) => {
            signal = context.signal;
            stale = context.editor;
            context.editor.on('change', edits);
            try {
              context.editor.setSchema({
                ...document(),
                context: { globalVariables: [{ name: 'untracked', defaultValue: true }] },
              });
            } catch (error) {
              initializationError = error;
              throw error;
            }
          },
        },
      ],
    });
    expect(() => bindEditorSession(editor, store, false)).toThrow('broken');
    expect((initializationError as Error).message).toContain('初始化期间');
    expect(store.getState().schema).toEqual(document());
    store.getState().setSchema({
      ...document(),
      context: { globalVariables: [{ name: 'later', defaultValue: true }] },
    });
    expect(edits).not.toHaveBeenCalled();
    expect(signal?.aborted).toBe(true);
    expect(() => stale!.setSchema(document())).toThrow('unavailable');
    expect(() => editor.setSchema(document())).toThrow('unavailable');
  });
});

// Server cannot protect the browser's flush-before-save sequence or stale callback dispatch.
describe('editor save boundary', () => {
  it('preserves drafts on flush failure, rejects duplicate saves and stops stale dispatch', async () => {
    const editor = createEditorInstance();
    const store = createEditorSession(document(), []);
    const draft = {
      ...document(),
      context: {
        globalVariables: [{ name: 'draft', type: 'string' as const, defaultValue: 'retained' }],
      },
    };
    store.getState().setSchema(draft);
    let saves = 0;
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const detach = bindEditorSession(editor, store, false, {
      onFlush: () => pending,
      onSave: async () => {
        saves++;
      },
    });
    const saving = editor.save();
    await expect(editor.save()).rejects.toThrow('正在保存');
    detach();
    const detachNext = bindEditorSession(editor, createEditorSession(document(), []), false, {
      onSave: async () => {
        saves++;
      },
    });
    release();
    await expect(saving).rejects.toThrow('会话已切换');
    expect(saves).toBe(0);
    detachNext();
    const detachFailure = bindEditorSession(editor, store, false, {
      onFlush: async () => {
        throw new Error('flush rejected');
      },
      onSave: async () => {
        saves++;
      },
    });
    await expect(editor.save()).rejects.toThrow('flush rejected');
    expect(store.getState().schema).toEqual(draft);
    expect(saves).toBe(0);
    detachFailure();
    let failSave = true;
    const detachRetry = bindEditorSession(editor, store, true, {
      onSave: async () => {
        if (failSave) throw new Error('save rejected');
        saves++;
      },
    });
    await expect(editor.save()).rejects.toThrow('save rejected');
    expect(store.getState().schema).toEqual(draft);
    failSave = false;
    await editor.save();
    expect(saves).toBe(1);
    expect(store.getState().schema).toEqual(draft);
    detachRetry();
  });
});

// Plugin mutations introduce a browser-owned path into Working; Server cannot prove
// local atomicity, immutable notifications or observer/session isolation.
describe('public editor operations', () => {
  const materials = [
    { type: 'container', title: 'Container', Component: () => null, acceptsChildren: true },
    { type: 'button', title: 'Button', Component: () => null, defaultProps: { text: 'default' } },
  ];
  it('uses the shared draft/history path and reports actual positions without shifted-sibling moves', () => {
    const editor = createEditorInstance();
    const store = createEditorSession(document(), materials);
    const detach = bindEditorSession(editor, store, false);
    const changes: EditorEvents['change'][] = [];
    const inserts: EditorEvents['elementInsert'][] = [];
    const removes: EditorEvents['elementRemove'][] = [];
    editor.on('change', (event) => changes.push(event));
    editor.on('elementInsert', (event) => inserts.push(event));
    editor.on('elementRemove', (event) => removes.push(event));
    const id = editor.insertElement({ materialType: 'button', position: { beforeId: 'button' } });
    expect(inserts[0]).toMatchObject({
      source: 'plugin',
      materialType: 'button',
      element: { id, props: { text: 'default' } },
      position: { parentId: 'root', index: 0 },
    });
    expect(changes[0]!.transactionId).toBe(inserts[0]!.transactionId);
    expect(changes[0]!.changes.map((change) => change.type)).toEqual(['elementInsert']);
    expect(Object.isFrozen(editor.getSchema().elements[id]!.props)).toBe(true);
    const patch = { nested: { value: 1 } };
    editor.updateElementProps(id, patch);
    patch.nested.value = 99;
    expect(editor.getElement(id)!.props.nested).toEqual({ value: 1 });
    editor.removeElementProps(id, ['nested']);
    expect(editor.getElement(id)!.props).toEqual({ text: 'default' });
    editor.moveElement({ elementId: id, position: { afterId: 'button' } });
    expect(changes.at(-1)!.changes).toEqual([
      {
        type: 'elementMove',
        elementId: id,
        previousPosition: { parentId: 'root', index: 0 },
        position: { parentId: 'root', index: 1 },
      },
    ]);
    const accepted = changes.length;
    const beforeInvalid = store.getState().schema;
    expect(() =>
      editor.insertElement({ materialType: 'missing', position: { parentId: 'root' } }),
    ).toThrow('未知物料');
    expect(() => editor.moveElement({ elementId: id, position: { parentId: 'button' } })).toThrow(
      '不允许',
    );
    expect(() =>
      editor.insertElement({ materialType: 'button', position: { parentId: 'root', index: -1 } }),
    ).toThrow('索引');
    expect(changes).toHaveLength(accepted);
    expect(store.getState().schema).toBe(beforeInvalid);
    editor.selectElement(id);
    expect(editor.getSelectedElement()!.id).toBe(id);
    expect(editor.getParent(id)!.id).toBe('root');
    expect(editor.getAncestors(id).map((element) => element.id)).toEqual(['root']);
    editor.removeElement(id);
    expect(removes[0]).toMatchObject({
      element: { id },
      previousPosition: { parentId: 'root', index: 1 },
      subtree: { elements: { [id]: { type: 'button' } } },
    });
    expect(editor.getSelectedElement()).toBeNull();
    editor.undo();
    expect(editor.getElement(id)).toBeTruthy();
    expect(changes.at(-1)!.source).toBe('history');
    const containerId = editor.insertElement({
      materialType: 'container',
      position: { parentId: 'root' },
    });
    editor.moveElement({ elementId: 'button', position: { parentId: containerId } });
    expect(() =>
      editor.moveElement({ elementId: containerId, position: { parentId: containerId } }),
    ).toThrow('自身子树');
    const removedBefore = removes.length;
    editor.removeElement(containerId);
    expect(removes).toHaveLength(removedBefore + 1);
    expect(Object.keys(removes.at(-1)!.subtree.elements).sort()).toEqual(
      [containerId, 'button'].sort(),
    );
    expect(removes.at(-1)!.subtree.flows.click).toBeTruthy();
    expect(editor.getSchema().bindElements).toEqual([]);
    detach();
  });

  it('isolates failed/reentrant observers and unsubscribes them at the session boundary', () => {
    const observerError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const observed: string[] = [];
      let reentrantError: unknown;
      let immutableError: unknown;
      let scoped!: EditorInstance;
      const editor = createEditorInstance({
        plugins: [
          {
            id: 'observer',
            setup: ({ editor: instance }) => {
              scoped = instance;
              instance.on('elementInsert', (event) => {
                try {
                  instance.removeElement('button');
                } catch (error) {
                  reentrantError = error;
                }
                try {
                  (event.element.props as Record<string, unknown>).text = 'tampered';
                } catch (error) {
                  immutableError = error;
                }
                throw new Error('observer failure');
              });
              instance.on('elementInsert', (event) => observed.push(event.element.id));
            },
          },
        ],
      });
      const first = createEditorSession(document(), materials);
      const detach = bindEditorSession(editor, first, false);
      // The canvas uses the same accepted-snapshot entry, with drag source metadata.
      const inserted = SchemaUtils.insertElement(first.getState().schema, 'root', {
        id: 'dragged',
        type: 'button',
      }).schema;
      first.getState().setSchema(inserted, { source: 'drag' });
      expect(observed).toEqual(['dragged']);
      expect(reentrantError).toBeInstanceOf(Error);
      expect((reentrantError as Error).message).toContain('同步修改');
      expect(immutableError).toBeInstanceOf(TypeError);
      expect(first.getState().schema.elements.dragged).toBeTruthy();
      expect(observerError).toHaveBeenCalledTimes(1);
      const oldScoped = scoped;
      detach();
      const second = createEditorSession(document(), materials);
      const detachSecond = bindEditorSession(editor, second, true);
      expect(() => oldScoped.getSchema()).toThrow('unavailable');
      expect(() => oldScoped.on('change', () => undefined)).toThrow('unavailable');
      expect(() => editor.removeElement('button')).toThrow('不可编辑');
      first.getState().setSchema(document());
      first.getState().setSchema(inserted);
      expect(observed).toEqual(['dragged']);
      expect(second.getState().canUndo).toBe(false);
      detachSecond();
    } finally {
      observerError.mockRestore();
    }
  });
});
