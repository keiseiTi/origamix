import { createContext, useContext } from 'react';
import type { OrigamixPageSchema as Schema } from '@origamix/shared';
import type { Material } from '../../interfaces/material';
import type { MaterialManifest } from '@origamix/shared';

/** Internal view contract; the parent Editor owns the engine and edit session. */
export const EditorPageNavigationContext = createContext<
  import('@origamix/shared').PageNavigationMetadata | undefined
>(undefined);
export interface FlowEditorSession {
  pageNavigation?: import('@origamix/shared').PageNavigationMetadata;
  schema: Schema;
  materials: readonly Pick<Material, 'type' | 'title' | 'contextConfig' | 'editorConfig'>[];
  catalog: readonly MaterialManifest[];
  onChange: (schema: Schema) => void;
  history: { canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void };
}
export const FlowEditorSessionContext = createContext<FlowEditorSession | null>(null);
export const useFlowEditorSession = (): FlowEditorSession => {
  const session = useContext(FlowEditorSessionContext);
  if (!session) throw new Error('FlowEditor requires an editor session');
  return session;
};
