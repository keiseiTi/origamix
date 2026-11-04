import type { Environment } from 'monaco-editor/esm/vs/editor/editor.api.js';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker.js?worker';

// Keep worker setup with CodeEditor, including standalone history/attribute editors.
const environment: Environment = {
  getWorker: (_moduleId, label) => (label === 'json' ? new JsonWorker() : new EditorWorker()),
};

export const configureMonacoWorkers = (): void => {
  globalThis.MonacoEnvironment = environment;
};
