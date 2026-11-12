/* eslint-disable @typescript-eslint/triple-slash-reference -- Source exports must include ambient bundler declarations without emitting runtime imports of .d.ts files. */
/// <reference path="./worker-imports.d.ts" />
/// <reference path="./styles.d.ts" />
/* eslint-enable @typescript-eslint/triple-slash-reference */
export { Editor } from './editor';
export { createEditorTransaction } from './transactions/create-editor-transaction';
export { deriveSchemaOperations } from './transactions/derive-schema-operations';

export {
  CanvasPrototypeSurface,
  type CanvasPrototypeCommand,
  type CanvasPrototypeHandle,
  type CanvasPrototypeSnapshot,
} from './prototype/canvas-prototype';
export { CanvasPrototypeSession } from './prototype/canvas-prototype-session';
export { mountCanvasPrototypeFrame } from './prototype/mount-canvas-prototype-frame';
export { createCanvasPrototypeDocument } from './prototype/create-canvas-prototype-document';

export { useCreateEditor } from './hooks/use-create-editor';
export { useEditorContext } from './hooks/use-editor-context';
export { useEditorSelector } from './hooks/use-editor-selector';

export {
  type EditorPublicState,
  type EditorInstance,
  type CreateEditorOptions,
  type EditorSaveOptions,
} from './interfaces/editor-instance';
export type * from './interfaces/editor';
export type * from './interfaces/property-editor';
export type * from './interfaces/editor-operation';

export { SchemaEditor } from './components/schema-editor';
export { GlobalVariablesEditor } from './components/global-variables-editor';
export { CodeEditor, type CodeEditorProps } from './components/code-editor';
export { JsonAttributeField } from './components/json-attribute-field';
export {
  EditorToolbar,
  EditorToolbarArea,
  EditorSaveButton,
} from './components/editor-layout/editor-toolbar';

export { defineEditorPlugin } from './plugins/define-editor-plugin';
export type * from './interfaces/plugin';

export { createEditorModePlugin } from './plugins/toolbar/mode-plugin';
export { createViewportPlugin } from './plugins/toolbar/viewport-plugin';
export { createHistoryPlugin } from './plugins/toolbar/history-plugin';

export { ModeTools } from './plugins/toolbar/mode-tools';
export { ViewportTools } from './plugins/toolbar/viewport-tools';
export { HistoryTools } from './plugins/toolbar/history-tools';
