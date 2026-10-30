import { Toaster, createToastManager } from '@origamix/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  type DragOverEvent,
  type DragEndEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import type { OrigamixPageSchema } from '@origamix/shared';
import type { Material } from '../contracts/material-contracts';
import { createEditorSession, EditorSessionContext, type DragElement } from './editor-session';
import { getInsertionAxis } from '../canvas/layout-axis';
import { SchemaUtils } from '../schema/schema-utils';

export interface EditorProviderProps {
  schema: OrigamixPageSchema;
  materials: Material[];
  children?: ReactNode;
  onChange?: (schema: OrigamixPageSchema) => void;
}
/** Store construction and DnD lifecycle are scoped to this provider, never a module singleton. */
export const EditorProvider = ({
  schema,
  materials,
  children,
  onChange,
}: EditorProviderProps): React.JSX.Element => {
  const [store] = useState(() => createEditorSession(schema, materials));
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);
  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (state.schema !== previous.schema) callback.current?.(state.schema);
      }),
    [store],
  );
  const [notifications] = useState(() => createToastManager());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );
  const cancel = () => {
    store.getState().setDragElement(null);
    store.getState().setInsertPosition(null);
  };
  const collision: CollisionDetection = (args) => {
    const pointer = pointerWithin(args);
    const hits = pointer.length ? pointer : rectIntersection(args);
    const placeholder = hits.find((hit) => String(hit.id).endsWith('-placeholder'));
    // Prefer the deepest Schema node, including when children overflow their parent.
    return placeholder
      ? [placeholder]
      : [...hits]
          .sort((left, right) => {
            const schema = store.getState().schema;
            return (
              SchemaUtils.getParents(schema, String(right.id)).length -
              SchemaUtils.getParents(schema, String(left.id)).length
            );
          })
          .slice(0, 1);
  };
  const locate = (event: DragOverEvent | DragEndEvent) => {
    const { over } = event;
    const state = store.getState();
    const target = over?.data.current as { id: string; material: Material } | undefined;
    if (!over || !target || !state.schema.elements[target.id]) return null;
    const translated = event.active.rect.current.translated;
    const activation = event.activatorEvent;
    const point =
      'clientX' in activation && 'clientY' in activation
        ? {
            x: Number(activation.clientX) + event.delta.x,
            y: Number(activation.clientY) + event.delta.y,
          }
        : {
            x: (translated?.left ?? over.rect.left) + (translated?.width ?? 0) / 2,
            y: (translated?.top ?? over.rect.top) + (translated?.height ?? 0) / 2,
          };
    const drag = state.dragElement;
    const dragged = drag
      ? 'material' in drag
        ? { material: drag.material, props: state.schema.elements[drag.id]?.props ?? {} }
        : { material: drag, props: drag.defaultProps ?? {} }
      : undefined;
    const vertical =
      getInsertionAxis(state.schema, state.materials, target.id, state.canvasRoot, dragged) ===
      'vertical';
    if (target.material.acceptsChildren) {
      const edge = Math.min(12, (vertical ? over.rect.height : over.rect.width) / 4);
      const coordinate = vertical ? point.y : point.x;
      const start = vertical ? over.rect.top : over.rect.left;
      const end = vertical ? over.rect.bottom : over.rect.right;
      if (target.id !== state.schema.layout.root) {
        if (coordinate < start + edge)
          return { target, position: vertical ? 'up' : 'before' } as const;
        if (coordinate > end - edge)
          return { target, position: vertical ? 'down' : 'after' } as const;
      }
      return { target, position: undefined };
    }
    const coordinate = vertical ? point.y : point.x;
    const middle = vertical
      ? over.rect.top + over.rect.height / 2
      : over.rect.left + over.rect.width / 2;
    const position = vertical
      ? coordinate < middle
        ? 'up'
        : 'down'
      : coordinate < middle
        ? 'before'
        : 'after';
    return { target, position } as const;
  };
  return (
    <Toaster toastManager={notifications}>
      <EditorSessionContext.Provider value={store}>
        <DndContext
          sensors={sensors}
          collisionDetection={collision}
          onDragStart={(event) => {
            store.getState().setDragElement(event.active.data.current as DragElement);
          }}
          onDragMove={(event) => {
            const hit = locate(event);
            store
              .getState()
              .setInsertPosition(
                hit?.position ? { id: hit.target.id, position: hit.position } : null,
              );
          }}
          onDragCancel={cancel}
          onDragEnd={(event) => {
            try {
              const hit = locate(event),
                state = store.getState(),
                drag = state.dragElement;
              if (!hit || !drag) return;
              const moving = 'material' in drag;
              const material = moving ? drag.material : drag;
              const parentId = hit.position
                ? SchemaUtils.getParents(state.schema, hit.target.id)[0]
                : hit.target.id;
              const parent = parentId ? state.schema.elements[parentId] : undefined;
              const parentMaterial = state.materials.find((item) => item.type === parent?.type);
              if (
                !parent ||
                !parentMaterial?.acceptsChildren ||
                (material.dropTypes && !material.dropTypes.includes(parent.type))
              )
                throw new Error('该物料不允许放入目标容器');
              const result = moving
                ? SchemaUtils.moveElement(state.schema, drag.id, hit.target.id, {
                    mode: hit.position ? 'same-level' : 'cross-level',
                    position: hit.position,
                  })
                : (() => {
                    const element = {
                      id: `${material.type}-${crypto.randomUUID()}`,
                      type: material.type,
                      props: structuredClone(material.defaultProps ?? {}),
                    };
                    return hit.position
                      ? SchemaUtils.insertAdjacentElement(
                          state.schema,
                          hit.target.id,
                          element,
                          hit.position,
                        )
                      : SchemaUtils.insertElement(state.schema, hit.target.id, element);
                  })();
              state.setSchema(result.schema);
              const id = result.operation.elementId;
              state.setActiveElement({ id, ...result.schema.elements[id]!, material });
            } catch (reason) {
              notifications.add({
                id: 'editor-drag-error',
                type: 'error',
                priority: 'high',
                title: reason instanceof Error ? reason.message : '移动失败，草稿已保留',
              });
            } finally {
              cancel();
            }
          }}
        >
          {children}
        </DndContext>
      </EditorSessionContext.Provider>
    </Toaster>
  );
};
