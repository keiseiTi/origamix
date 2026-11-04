import type { StoreApi } from 'zustand/vanilla';
import type { EditorCore } from './editor-store';
import type {
  EditorInstance,
  EditorPublicState,
  EditorViewState,
} from '../interfaces/editor-instance-interfaces';
import { getEditorViewStore } from './editor-instance';
export const createPublicSource = (
  editor: EditorInstance,
  core: StoreApi<EditorCore>,
): Pick<StoreApi<EditorPublicState>, 'getState' | 'getInitialState' | 'subscribe'> => {
  const view = getEditorViewStore(editor);
  let previousCore: EditorCore | undefined;
  let previousView: EditorViewState | undefined;
  let snapshot: EditorPublicState;
  const getState = (): EditorPublicState => {
    const currentCore = core.getState();
    const currentView = view.getState();
    if (previousCore !== currentCore || previousView !== currentView) {
      const active = currentCore.activeElement;
      const activeElement =
        previousCore?.activeElement === active
          ? snapshot.activeElement
          : active
            ? { id: active.id, type: active.type }
            : null;
      previousCore = currentCore;
      previousView = currentView;
      snapshot = {
        canUndo: currentCore.canUndo,
        canRedo: currentCore.canRedo,
        activeElement,
        readOnly: currentCore.readOnly,
        ...currentView,
      };
    }
    return snapshot;
  };
  return {
    getState,
    getInitialState: getState,
    subscribe: (listener) => {
      let previous = getState();
      const notify = () => {
        const current = getState();
        const old = previous;
        previous = current;
        listener(current, old);
      };
      const unsubscribeCore = core.subscribe(notify);
      const unsubscribeView = view.subscribe(notify);
      return () => {
        unsubscribeCore();
        unsubscribeView();
      };
    },
  };
};
