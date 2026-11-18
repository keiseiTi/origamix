import type { EditorPlugin } from '../interfaces/plugin';
import { Toaster, createToastManager } from '@origamix/ui';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { OrigamixPageSchema } from '@origamix/shared';
import type { Material } from '../interfaces/material';
import { createEditorSession, type EditorEnvironment } from './editor-store';
import { EditorSessionContext } from './editor-context';
import { CanvasDragContext } from '../components/canvas/canvas-drag-context';
import { useBindEditor } from './use-bind-editor';
import { type EditorInstance, type EditorSaveOptions } from '../interfaces/editor-instance';

const EMPTY_BLOCKS: NonNullable<EditorProviderProps['blocks']> = [];
const EMPTY_ROOT_TYPES: readonly string[] = [];
const EMPTY_SAVE: EditorSaveOptions = {};
const EMPTY_CATALOG: EditorEnvironment['materialCatalog'] = [];

const EditorBinding = ({
  editor,
  readOnly,
  save,
}: {
  editor: EditorInstance;
  readOnly: boolean;
  save: EditorSaveOptions;
}) => {
  useBindEditor(editor, readOnly, save);
  return null;
};

export interface EditorProviderProps {
  editor?: EditorInstance;
  plugins?: readonly EditorPlugin[];
  save?: EditorSaveOptions;
  readOnly?: boolean;
  validateSchema?: EditorEnvironment['validateSchema'];
  theme?: EditorEnvironment['theme'];
  materialCatalog?: EditorEnvironment['materialCatalog'];
  rootMaterialTypes?: readonly string[];
  blocks?: EditorEnvironment['blocks'];
  targetSelection?: EditorEnvironment['targetSelection'];
  schema: OrigamixPageSchema;
  materials: Material[];
  children?: ReactNode;
  onChange?: (schema: OrigamixPageSchema) => void;
}
/** Store construction and DnD lifecycle are scoped to this provider, never a module singleton. */
export const EditorProvider = ({
  schema,
  materials,
  editor,
  plugins,
  save = EMPTY_SAVE,
  readOnly = false,
  validateSchema,
  theme = 'light',
  materialCatalog = EMPTY_CATALOG,
  rootMaterialTypes = EMPTY_ROOT_TYPES,
  blocks = EMPTY_BLOCKS,
  targetSelection,
  children,
  onChange,
}: EditorProviderProps): React.JSX.Element => {
  const [store] = useState(() =>
    createEditorSession(schema, materials, 100, {
      editor,
      plugins,
      readOnly,
      theme,
      materialCatalog,
      rootMaterialTypes,
      blocks,
      targetSelection,
      validateSchema,
    }),
  );
  useLayoutEffect(() => {
    store.setState({
      editor,
      readOnly,
      theme,
      materialCatalog,
      rootMaterialTypes,
      blocks,
      targetSelection,
      validateSchema,
    });
  }, [
    store,
    editor,
    readOnly,
    theme,
    materialCatalog,
    rootMaterialTypes,
    blocks,
    targetSelection,
    validateSchema,
  ]);
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);
  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (state.schema !== previous.schema) callback.current?.(state.schema);
      }),
    [store],
  );
  const [notifications] = useState(() => createToastManager());
  return (
    <Toaster toastManager={notifications}>
      <EditorSessionContext.Provider value={store}>
        {editor && <EditorBinding editor={editor} readOnly={readOnly} save={save} />}
        <CanvasDragContext notifications={notifications}>{children}</CanvasDragContext>
      </EditorSessionContext.Provider>
    </Toaster>
  );
};
