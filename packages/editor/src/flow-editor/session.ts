import { createContext, useContext } from 'react';
import type { Schema } from '@tangramino/engine';
import type { Material } from '@tangramino/base-editor';
import type { MaterialManifest } from '@origamix/shared';

/** Internal view contract; the parent Editor owns the engine and edit session. */
export interface FlowEditorSession {
  schema: Schema;
  materials: readonly Pick<Material, 'type' | 'title' | 'contextConfig' | 'editorConfig'>[];
  catalog: readonly MaterialManifest[];
  onChange: (schema: Schema) => void;
}
export const FlowEditorSessionContext = createContext<FlowEditorSession | null>(null);
export const useFlowEditorSession = (): FlowEditorSession => {
  const session = useContext(FlowEditorSessionContext);
  if (!session) throw new Error('FlowEditor requires an editor session');
  return session;
};
