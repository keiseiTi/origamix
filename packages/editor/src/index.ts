export { Editor, type EditorProps } from './editor';
export { CodeEditor, type CodeEditorProps } from './components/code-editor';
export { JsonAttributeField } from './components/json-attribute-field';
export { createEditorTransaction } from './transactions/create-editor-transaction';
export { deriveSchemaOperations } from './transactions/derive-schema-operations';
export type * from './contracts/editor-contracts';
export type * from './contracts/property-editor-contracts';
export {
  CanvasPrototypeSurface,
  type CanvasPrototypeCommand,
  type CanvasPrototypeHandle,
  type CanvasPrototypeSnapshot,
} from './prototype/canvas-prototype';
export { CanvasPrototypeSession } from './prototype/canvas-prototype-session';
export { mountCanvasPrototypeFrame } from './prototype/mount-canvas-prototype-frame';
export { createCanvasPrototypeDocument } from './prototype/create-canvas-prototype-document';

export {
  useCreateEditor,
  useEditorContext,
  useEditorSelector,
  type EditorPublicState,
  type EditorInstance,
  type CreateEditorOptions,
  type EditorSaveOptions,
} from './session/editor-controls';
export { SchemaEditor } from './tools/schema-editor';
export { GlobalVariablesEditor } from './tools/global-variables-editor';

export { defineEditorPlugin } from './contracts/plugin-contracts';
export type * from './contracts/plugin-contracts';

export { EditorToolbar, EditorToolbarArea, EditorSaveButton } from './layout/editor-toolbar';

export { createEditorModePlugin } from './plugins/toolbar/mode-plugin';
export { createViewportPlugin } from './plugins/toolbar/viewport-plugin';
export { createHistoryPlugin } from './plugins/toolbar/history-plugin';
