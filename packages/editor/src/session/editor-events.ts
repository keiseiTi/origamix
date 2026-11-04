import { equalJson, type OrigamixPageSchema } from '@origamix/shared';
import type {
  EditorChangeOptions,
  EditorElementChange,
  EditorEventListener,
  EditorEvents,
  EditorResolvedPosition,
} from '../interfaces/editor-operation-interfaces';
import { editorSnapshot } from './editor-snapshots';

export const elementPositions = (schema: OrigamixPageSchema): Map<string, EditorResolvedPosition> =>
  new Map(
    Object.entries(schema.layout.structure).flatMap(([parentId, children]) =>
      children.map((id, index) => [id, { parentId, index }] as const),
    ),
  );

// A sibling insertion/deletion shifts indices without moving surviving nodes.
const reorderedIds = (before: string[], after: string[]): Set<string> => {
  // IDs are unique, so the common subsequence is an LIS of previous indices.
  const positions = new Map(before.map((id, index) => [id, index]));
  const tails: number[] = [],
    previous: number[] = [];
  for (let index = 0; index < after.length; index++) {
    const value = positions.get(after[index]!)!;
    let left = 0,
      right = tails.length;
    while (left < right) {
      const middle = (left + right) >>> 1;
      if (positions.get(after[tails[middle]!]!)! < value) left = middle + 1;
      else right = middle;
    }
    previous[index] = left ? tails[left - 1]! : -1;
    tails[left] = index;
  }
  const retained = new Set<string>();
  for (let index = tails.at(-1) ?? -1; index >= 0; index = previous[index]!)
    retained.add(after[index]!);
  return new Set(after.filter((id) => !retained.has(id)));
};

export const describeEditorChanges = (
  before: OrigamixPageSchema,
  after: OrigamixPageSchema,
  movedElementId?: string,
): EditorElementChange[] => {
  const previous = elementPositions(before),
    next = elementPositions(after);
  const changes: EditorElementChange[] = [];
  const moved = new Set<string>();
  if (movedElementId) moved.add(movedElementId);
  else
    for (const [parentId, children] of Object.entries(after.layout.structure)) {
      const sameParent = (id: string) =>
        previous.get(id)?.parentId === parentId && next.get(id)?.parentId === parentId;
      for (const id of reorderedIds(
        (before.layout.structure[parentId] ?? []).filter(sameParent),
        children.filter(sameParent),
      ))
        moved.add(id);
    }
  for (const [id, element] of Object.entries(before.elements)) {
    if (after.elements[id] || !previous.has(id)) continue;
    const parentId = previous.get(id)!.parentId;
    if (!after.elements[parentId]) continue;
    const ids = new Set<string>();
    const visit = (key: string): void => {
      ids.add(key);
      for (const child of before.layout.structure[key] ?? [])
        if (!after.elements[child]) visit(child);
    };
    visit(id);
    const bindings = before.bindElements.filter((binding) => ids.has(binding.id));
    const flows = new Set(bindings.map((binding) => binding.flowId));
    changes.push({
      type: 'elementRemove',
      element: editorSnapshot({ id, ...element }),
      previousPosition: previous.get(id)!,
      subtree: editorSnapshot({
        elements: Object.fromEntries([...ids].map((key) => [key, before.elements[key]!])),
        layout: {
          root: id,
          structure: Object.fromEntries(
            [...ids].map((key) => [
              key,
              (before.layout.structure[key] ?? []).filter((child) => ids.has(child)),
            ]),
          ),
        },
        flows: Object.fromEntries(Object.entries(before.flows).filter(([key]) => flows.has(key))),
        bindElements: bindings,
        extensions: {
          ...before.extensions,
          ...(before.extensions.flowGraph
            ? {
                flowGraph: Object.fromEntries(
                  Object.entries(before.extensions.flowGraph).filter(([key]) =>
                    ids.has(key.split('::')[0]!),
                  ),
                ),
              }
            : {}),
        },
      }),
    });
  }
  for (const [id, element] of Object.entries(after.elements)) {
    const old = before.elements[id];
    if (!old) {
      const position = next.get(id);
      if (position)
        changes.push({
          type: 'elementInsert',
          element: editorSnapshot({ id, ...element }),
          materialType: element.type,
          position,
        });
      continue;
    }
    const oldPosition = previous.get(id),
      position = next.get(id);
    if (
      oldPosition &&
      position &&
      (oldPosition.parentId !== position.parentId || moved.has(id)) &&
      !equalJson(oldPosition, position)
    )
      changes.push({ type: 'elementMove', elementId: id, previousPosition: oldPosition, position });
    const fields = [...new Set([...Object.keys(old.props), ...Object.keys(element.props)])].filter(
      (key) =>
        Object.hasOwn(old.props, key) !== Object.hasOwn(element.props, key) ||
        !equalJson(old.props[key], element.props[key]),
    );
    if (fields.length)
      changes.push({
        type: 'elementPropsChange',
        elementId: id,
        previousProps: editorSnapshot(old.props),
        props: editorSnapshot(element.props),
        fields,
      });
  }
  return changes;
};

export const createEditorEvents = () => {
  const listeners = new Map<keyof EditorEvents, Set<(event: never) => void>>();
  let notifying = false;
  const guard = (): void => {
    if (notifying) throw new Error('不能在编辑通知中同步修改页面');
  };
  const emit = <K extends keyof EditorEvents>(type: K, payload: EditorEvents[K]): void => {
    if (!listeners.get(type)?.size) return;
    const snapshot = editorSnapshot(payload);
    const previous = notifying;
    notifying = true;
    try {
      for (const listener of [...(listeners.get(type) ?? [])]) {
        if (!listeners.get(type)?.has(listener)) continue;
        try {
          const result: unknown = listener(snapshot as never);
          if (result instanceof Promise)
            void result.catch(() =>
              console.error('Editor observer failed; accepted draft retained'),
            );
        } catch {
          console.error('Editor observer failed; accepted draft retained');
        }
      }
    } finally {
      notifying = previous;
    }
  };
  return {
    guard,
    on: <K extends keyof EditorEvents>(type: K, listener: EditorEventListener<K>): (() => void) => {
      let group = listeners.get(type);
      if (!group) {
        group = new Set();
        listeners.set(type, group);
      }
      group.add(listener as (event: never) => void);
      return () => {
        group.delete(listener as (event: never) => void);
        if (!group.size && listeners.get(type) === group) listeners.delete(type);
      };
    },
    selection: (
      previousElementId: string | null,
      elementId: string | null,
      source: EditorEvents['selectionChange']['source'] = 'canvas',
    ): void => {
      if (previousElementId !== elementId)
        emit('selectionChange', {
          transactionId: crypto.randomUUID(),
          source,
          previousElementId,
          elementId,
        });
    },
    change: (
      before: OrigamixPageSchema,
      after: OrigamixPageSchema,
      options: EditorChangeOptions = {},
      selection?: { previousElementId: string | null; elementId: string | null },
    ): void => {
      if (!listeners.size) return;
      const meta = { transactionId: crypto.randomUUID(), source: options.source ?? 'panel' };
      const changes = [...listeners.keys()].some((key) => key !== 'selectionChange')
        ? describeEditorChanges(before, after, options.movedElementId)
        : [];
      // Hold the guard over the complete transaction, including all granular notifications.
      const previous = notifying;
      notifying = true;
      try {
        for (const change of changes) {
          const { type, ...payload } = change;
          emit(type, { ...meta, ...payload } as EditorEvents[typeof type]);
        }
        if (selection && selection.previousElementId !== selection.elementId)
          emit('selectionChange', { ...meta, ...selection });
        if (listeners.has('change'))
          emit('change', {
            ...meta,
            before,
            after,
            changes,
            ...(options.historyGroup ? { historyGroup: options.historyGroup } : {}),
          });
      } finally {
        notifying = previous;
      }
    },
  };
};
