import { useCallback, useEffect, useRef } from 'react';
import type { OrigamixPageSchema } from '@origamix/shared';
import type { EditorProps } from './interfaces/editor-interfaces';
import { EditorProvider } from './session/editor-provider';
import { EditorChrome } from './components/editor-layout/editor-toolbar';
import { EditorCanvas } from './components/editor-layout/editor-canvas';
import { useEditorView } from './hooks/use-editor-view';
import { useEditorRegistration } from './hooks/use-editor-registration';

export const Editor = ({
  editor,
  onSave,
  onFlush,
  canSave,
  children,
  schema,
  sessionKey,
  registration,
  theme,
  onChange,
  readOnly = false,
  readOnlyMessage,
  targetSelection,
}: EditorProps): React.JSX.Element => {
  const mode = useEditorView(editor, (state) => state.mode);
  const viewportWidth = useEditorView(editor, (state) => state.viewportWidth);
  const { plugins, groups, rootMaterialTypes, materials } = useEditorRegistration(
    editor,
    registration,
  );

  // Host status updates must not rerun the engine's change effect for an unchanged schema.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const onEngineChange = useCallback(
    (next: OrigamixPageSchema): void => {
      if (!readOnly) onChangeRef.current(next, { immediate: mode === 'logic' });
    },
    [readOnly, mode],
  );

  return (
    <div className='relative border-t flex min-h-0 flex-1 flex-col bg-white dark:bg-zinc-950'>
      <EditorProvider
        key={sessionKey}
        editor={editor}
        plugins={plugins}
        save={{ onSave, onFlush, canSave }}
        readOnly={readOnly}
        theme={theme}
        materialCatalog={registration.catalog.materials}
        rootMaterialTypes={rootMaterialTypes}
        targetSelection={targetSelection}
        materials={materials}
        schema={schema}
        onChange={onEngineChange}
      >
        <EditorChrome>
          <div className='relative flex min-h-0 flex-1 flex-col'>
            <EditorCanvas
              groups={groups}
              viewportWidth={viewportWidth}
              mode={mode}
              onModeChange={editor.setMode}
            />
            {children}
            {readOnly && (
              <div
                className='absolute inset-0 z-20 grid place-items-center bg-white/45 backdrop-blur-[1px] dark:bg-zinc-950/55'
                role='status'
              >
                <span className='rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'>
                  {readOnlyMessage ?? '当前不可编辑'}
                </span>
              </div>
            )}
          </div>
        </EditorChrome>
      </EditorProvider>
    </div>
  );
};
