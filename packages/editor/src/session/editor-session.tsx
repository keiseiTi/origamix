import { createContext, useContext } from 'react';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { isPageSchema, type OrigamixPageSchema } from '@origamix/shared';
import type { Material } from '../contracts/material-contracts';

export type ActiveElement = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  material: Material;
  parents?: ActiveElement[];
};
export type DragElement =
  Material | { id: string; props: Record<string, unknown>; material: Material };
export type InsertPosition = { id: string; position: 'before' | 'after' | 'up' | 'down' };
export interface EditorCore {
  schema: OrigamixPageSchema;
  canvasRoot: HTMLElement | null;
  setCanvasRoot: (root: HTMLElement | null) => void;
  materials: Material[];
  activeElement: ActiveElement | null;
  dragElement: DragElement | null;
  insertPosition: InsertPosition | null;
  canUndo: boolean;
  canRedo: boolean;
  setSchema: (schema: OrigamixPageSchema, options?: { historyGroup?: string }) => void;
  setActiveElement: (element: ActiveElement | null) => void;
  setDragElement: (element: DragElement | null) => void;
  setInsertPosition: (position: InsertPosition | null) => void;
  undo: () => void;
  redo: () => void;
}
/** Each mounted provider owns its draft projection and complete document history. */
export const createEditorSession = (
  schema: OrigamixPageSchema,
  materials: Material[],
  limit = 100,
): StoreApi<EditorCore> => {
  const undos: OrigamixPageSchema[] = [],
    redos: OrigamixPageSchema[] = [];
  let lastGroup: string | undefined,
    lastEdit = 0;
  return createStore<EditorCore>((set, get) => {
    const project = (next: OrigamixPageSchema) => {
      const active = get().activeElement;
      const element = active ? next.elements[active.id] : undefined;
      set({
        schema: next,
        activeElement: active && element ? { ...active, ...element } : null,
        canUndo: undos.length > 0,
        canRedo: redos.length > 0,
      });
    };
    return {
      schema,
      materials,
      canvasRoot: null,
      setCanvasRoot: (canvasRoot) => set({ canvasRoot }),
      activeElement: null,
      dragElement: null,
      insertPosition: null,
      canUndo: false,
      canRedo: false,
      setSchema: (next, options) => {
        const current = get().schema;
        if (current === next || JSON.stringify(current) === JSON.stringify(next)) return;
        if (!isPageSchema(next)) throw new Error('编辑结果无效，原有草稿已保留');
        const knownTypes = new Set(materials.map((material) => material.type));
        if (
          materials.length &&
          Object.values(next.elements).some((element) => !knownTypes.has(element.type))
        )
          throw new Error('编辑结果包含未知物料，原有草稿已保留');
        // A design tree cannot render one identity under multiple parents.
        const children = new Set<string>();
        for (const ids of Object.values(next.layout.structure))
          for (const id of ids) {
            if (id === next.layout.root || children.has(id))
              throw new Error('元素不能重复出现在布局中，原有草稿已保留');
            children.add(id);
          }
        const group = options?.historyGroup;
        const now = Date.now();
        if (!group || group !== lastGroup || now - lastEdit > 600) {
          undos.push(current);
          if (undos.length > limit) undos.shift();
        }
        lastGroup = group;
        lastEdit = now;
        redos.length = 0;
        project(next);
      },
      setActiveElement: (activeElement) => set({ activeElement }),
      setDragElement: (dragElement) => set({ dragElement }),
      setInsertPosition: (insertPosition) => set({ insertPosition }),
      undo: () => {
        lastGroup = undefined;
        const previous = undos.pop();
        if (previous) {
          redos.push(get().schema);
          project(previous);
        }
      },
      redo: () => {
        lastGroup = undefined;
        const next = redos.pop();
        if (next) {
          undos.push(get().schema);
          project(next);
        }
      },
    };
  });
};
export const EditorSessionContext = createContext<StoreApi<EditorCore> | null>(null);
export const useEditorStoreApi = (): StoreApi<EditorCore> => {
  const store = useContext(EditorSessionContext);
  if (!store) throw new Error('Editor session is unavailable');
  return store;
};
const identity = (state: EditorCore): EditorCore => state;
export const useEditorCore = <T = EditorCore,>(
  selector: (state: EditorCore) => T = identity as (state: EditorCore) => T,
): T => useStore(useEditorStoreApi(), selector);
