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
