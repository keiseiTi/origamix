import { useEditorCore } from '../../session/editor-context';

export const useTargetSelection = () => useEditorCore((state) => state.targetSelection);
