import type { OrigamixPageSchema } from '@origamix/shared';
import type { Material } from './material';

export type EditorReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: EditorReadonly<T[K]> }
    : T;
export type EditorElement = { id: string } & OrigamixPageSchema['elements'][string];
export type EditorChangeSource = 'drag' | 'canvas' | 'panel' | 'plugin' | 'history' | 'external';
export type EditorElementPosition =
  { parentId: string; index?: number } | { beforeId: string } | { afterId: string };
export type EditorResolvedPosition = Readonly<{ parentId: string; index: number }>;
export type EditorChangeOptions = {
  source?: EditorChangeSource;
  historyGroup?: string;
  movedElementId?: string;
};
export type EditorChangeMeta = Readonly<{ transactionId: string; source: EditorChangeSource }>;
export type EditorElementChange =
  | {
      type: 'elementInsert';
      element: EditorReadonly<EditorElement>;
      materialType: string;
      position: EditorResolvedPosition;
    }
  | {
      type: 'elementRemove';
      element: EditorReadonly<EditorElement>;
      subtree: EditorReadonly<
        Pick<OrigamixPageSchema, 'elements' | 'layout' | 'flows' | 'bindElements' | 'extensions'>
      >;
      previousPosition: EditorResolvedPosition;
    }
  | {
      type: 'elementMove';
      elementId: string;
      previousPosition: EditorResolvedPosition;
      position: EditorResolvedPosition;
    }
  | {
      type: 'elementPropsChange';
      elementId: string;
      previousProps: EditorReadonly<Record<string, unknown>>;
      props: EditorReadonly<Record<string, unknown>>;
      fields: readonly string[];
    };
export type EditorEvents = {
  [K in EditorElementChange['type']]: EditorChangeMeta &
    Omit<Extract<EditorElementChange, { type: K }>, 'type'>;
} & {
  selectionChange: EditorChangeMeta & {
    previousElementId: string | null;
    elementId: string | null;
  };
  change: EditorChangeMeta & {
    before: EditorReadonly<OrigamixPageSchema>;
    after: EditorReadonly<OrigamixPageSchema>;
    changes: EditorReadonly<EditorElementChange[]>;
    historyGroup?: string;
  };
};
export type EditorEventListener<K extends keyof EditorEvents> = (event: EditorEvents[K]) => void;
export interface EditorOperations {
  getSchema: () => EditorReadonly<OrigamixPageSchema>;
  getElement: (elementId: string) => EditorReadonly<EditorElement> | undefined;
  getMaterial: (type: string) => EditorReadonly<Material> | undefined;
  getParent: (elementId: string) => EditorReadonly<EditorElement> | undefined;
  /** Nearest parent first. */
  getAncestors: (elementId: string) => readonly EditorReadonly<EditorElement>[];
  getSelectedElement: () => EditorReadonly<EditorElement> | null;
  insertElement: (options: {
    materialType: string;
    props?: Record<string, unknown>;
    position: EditorElementPosition;
  }) => string;
  moveElement: (options: { elementId: string; position: EditorElementPosition }) => void;
  removeElement: (elementId: string) => void;
  updateElementProps: (elementId: string, props: Record<string, unknown>) => void;
  removeElementProps: (elementId: string, fields: readonly string[]) => void;
  selectElement: (elementId: string | null) => void;
  on: <K extends keyof EditorEvents>(event: K, listener: EditorEventListener<K>) => () => void;
}
