import type { EditorPlugin } from '../interfaces/plugin-interfaces';
import { equalJson } from '@origamix/shared';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { isPageSchema, type OrigamixPageSchema } from '@origamix/shared';
import { createEditorEvents } from './editor-events';
import type {
  EditorChangeOptions,
  EditorOperations,
} from '../interfaces/editor-operation-interfaces';
import { SchemaUtils } from '../schema/schema-utils';
import type { EditorInstance } from '../interfaces/editor-instance-interfaces';
import type { EditorTheme, EditorTargetSelection } from '../interfaces/editor-interfaces';
import type { MaterialManifest } from '@origamix/shared';
import type { Material } from '../interfaces/material-interfaces';

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
export interface EditorEnvironment {
  plugins: readonly EditorPlugin[] | undefined;
  theme: EditorTheme;
  materialCatalog: readonly MaterialManifest[];
  rootMaterialTypes: readonly string[];
  targetSelection: EditorTargetSelection | undefined;
  readOnly: boolean;
  editor: EditorInstance | undefined;
}
export interface EditorCore extends EditorEnvironment {
  schema: OrigamixPageSchema;
  canvasRoot: HTMLElement | null;
  setCanvasRoot: (root: HTMLElement | null) => void;
  materials: Material[];
  activeElement: ActiveElement | null;
  dragElement: DragElement | null;
  insertPosition: InsertPosition | null;
  openOverlayIds: string[];
  closeOverlay: (id: string) => void;
  canUndo: boolean;
  canRedo: boolean;
  on: EditorOperations['on'];
  assertCanMutate: () => void;
  setSchema: (schema: OrigamixPageSchema, options?: EditorChangeOptions) => void;
  setActiveElement: (element: ActiveElement | null, source?: EditorChangeOptions['source']) => void;
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
  environment: Partial<EditorEnvironment> = {},
): StoreApi<EditorCore> => {
  const events = createEditorEvents();
  const undos: OrigamixPageSchema[] = [],
    redos: OrigamixPageSchema[] = [];
  let lastGroup: string | undefined,
    lastEdit = 0;
  return createStore<EditorCore>((set, get) => {
    const overlayPath = (next: OrigamixPageSchema, id: string): string[] =>
      [...SchemaUtils.getParents(next, id).reverse(), id].filter(
        (elementId) =>
          materials.find((material) => material.type === next.elements[elementId]?.type)
            ?.editorConfig?.presentation === 'overlay',
      );
    const assertCanMutate = (): void => {
      events.guard();
      if (get().readOnly) throw new Error('当前不可编辑，草稿已保留');
    };
    const project = (next: OrigamixPageSchema, options: EditorChangeOptions) => {
      const before = get().schema;
      const active = get().activeElement;
      const element = active ? next.elements[active.id] : undefined;
      set({
        schema: next,
        activeElement: active && element ? { ...active, ...element } : null,
        openOverlayIds: get().openOverlayIds.filter((id) => Boolean(next.elements[id])),
        canUndo: undos.length > 0,
        canRedo: redos.length > 0,
      });
      events.change(before, next, options, {
        previousElementId: active?.id ?? null,
        elementId: get().activeElement?.id ?? null,
      });
    };
    return {
      on: events.on,
      assertCanMutate,
      plugins: undefined,
      theme: 'light',
      materialCatalog: [],
      rootMaterialTypes: [],
      targetSelection: undefined,
      readOnly: false,
      editor: undefined,
      ...environment,
      schema,
      materials,
      canvasRoot: null,
      setCanvasRoot: (canvasRoot) => set({ canvasRoot }),
      activeElement: null,
      openOverlayIds: [],
      closeOverlay: (id) =>
        set((state) => {
          const index = state.openOverlayIds.indexOf(id);
          return index < 0 ? {} : { openOverlayIds: state.openOverlayIds.slice(0, index) };
        }),
      dragElement: null,
      insertPosition: null,
      canUndo: false,
      canRedo: false,
      setSchema: (candidate, options = {}) => {
        assertCanMutate();
        const next = structuredClone(candidate);
        const current = get().schema;
        if (equalJson(current, next)) return;
        if (!isPageSchema(next)) throw new Error('编辑结果无效，原有草稿已保留');
        const knownTypes = new Set(materials.map((material) => material.type));
        if (
          materials.length &&
          Object.values(next.elements).some((element) => !knownTypes.has(element.type))
        )
          throw new Error('编辑结果包含未知物料，原有草稿已保留');
        const group = options?.historyGroup;
        const now = Date.now();
        if (!group || group !== lastGroup || now - lastEdit > 600) {
          undos.push(current);
          if (undos.length > limit) undos.shift();
        }
        lastGroup = group;
        lastEdit = now;
        redos.length = 0;
        project(next, options);
      },
      setActiveElement: (activeElement, source = 'canvas') => {
        events.guard();
        const previousElementId = get().activeElement?.id ?? null;
        if (activeElement && !get().schema.elements[activeElement.id])
          throw new Error('元素不存在');
        set({
          activeElement,
          openOverlayIds: activeElement ? overlayPath(get().schema, activeElement.id) : [],
        });
        events.selection(previousElementId, activeElement?.id ?? null, source);
      },
      setDragElement: (dragElement) => set({ dragElement }),
      setInsertPosition: (insertPosition) => set({ insertPosition }),
      undo: () => {
        assertCanMutate();
        lastGroup = undefined;
        const previous = undos.pop();
        if (previous) {
          redos.push(get().schema);
          project(previous, { source: 'history' });
        }
      },
      redo: () => {
        assertCanMutate();
        lastGroup = undefined;
        const next = redos.pop();
        if (next) {
          undos.push(get().schema);
          project(next, { source: 'history' });
        }
      },
    };
  });
};
