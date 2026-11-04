import { useEditorCore } from '../session/editor-session';

export const useTargetSelection = () => useEditorCore((state) => state.targetSelection);
