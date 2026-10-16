import type { Material } from '@tangramino/base-editor';
import type { MaterialManifestCatalog } from '@origamix/shared/protocol/material-manifest';
import type { OrigamixPageSchema, SchemaOperation } from '@origamix/shared/protocol/schema';
import type { PropertyEditorRegistration } from './extensions';

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
}>;
