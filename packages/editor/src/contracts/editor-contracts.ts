import type { Material } from './material-contracts';
import {
  type MaterialManifestCatalog,
  type OrigamixPageSchema,
  type SchemaOperation,
} from '@origamix/shared';

import type { PropertyEditorRegistration } from './property-editor-contracts';

export type EditorTheme = 'light' | 'dark';
export type EditorMode = 'view' | 'logic';
export type EditorTool = 'history' | 'globals' | 'schema';
export type EditorHistoryState = Readonly<{ canUndo: boolean; canRedo: boolean }>;

/** App binds the callback to this page; late results must be ignored after a scope change. */
export type EditorPageScope = Readonly<{ projectId: string; pageId: string }>;
export type EditorWorkingState = Readonly<{
  scope: EditorPageScope;
  workingVersion: number;
  schema: OrigamixPageSchema;
}>;

/** One transaction becomes one atomic Working update, never a Revision or Apply. */
export type EditorTransaction = Readonly<{
  scope: EditorPageScope;
  baseWorkingVersion: number;
}> &
  (
    | Readonly<{ kind: 'operations'; operations: readonly [SchemaOperation, ...SchemaOperation[]] }>
    | Readonly<{
        kind: 'candidate';
        reason: 'operation-protocol-gap';
        schema: OrigamixPageSchema;
      }>
  );

/** App owns HTTP, version checks and recovery. Rejection must leave the local draft intact. */
export type CommitEditorTransaction = (
  transaction: EditorTransaction,
) => Promise<EditorWorkingState>;

export type EditorHandle = Readonly<{
  flush: () => Promise<void>;
  undo: () => void;
  redo: () => void;
}>;

/** Supplied by App after resolving the project's material set. No loader or concrete family here. */
export type EditorMaterialRegistration = Readonly<{
  catalog: MaterialManifestCatalog;
  groups: readonly Readonly<{ title: string; children: readonly Material[] }>[];
  propertyEditors: readonly PropertyEditorRegistration[];
  rootMaterials?: readonly Material[];
}>;

/** Host-controlled element picking for search, annotations or clarification. */
export type EditorTargetSelection = Readonly<{
  candidates: readonly Readonly<{ elementId: string; label: string }>[];
  highlightedElementId?: string | null;
  disabled?: boolean;
  onSelect: (elementId: string) => void;
}>;
