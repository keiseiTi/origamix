import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const [mountedSession, setMountedSession] = useState({ sessionKey, registration, editor });
  const switching =
    mountedSession.sessionKey !== sessionKey ||
    mountedSession.registration !== registration ||
    mountedSession.editor !== editor;
  useEffect(() => {
    if (!switching) return;
    // Commit an empty boundary first so all old bindings, portals and plugins
    // clean up before the replacement provider mounts.
    const timer = window.setTimeout(
      () => setMountedSession({ sessionKey, registration, editor }),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [switching, sessionKey, registration, editor]);
  const readySession = useRef<typeof mountedSession | null>(null);
  useLayoutEffect(() => {
    readySession.current = null;
    if (switching) return;
    // Ignore mount/bootstrap snapshots, including after an explicit switch.
    const timer = window.setTimeout(() => {
      readySession.current = mountedSession;
    }, 0);
    return () => {
      window.clearTimeout(timer);
      readySession.current = null;
    };
  }, [switching, mountedSession]);
  const mode = useEditorView(editor, (state) => state.mode);
  const viewportWidth = useEditorView(editor, (state) => state.viewportWidth);
  const { plugins, groups, rootMaterialTypes, materials } = useEditorRegistration(
    editor,
    registration,
  );

  // Host status updates must not rerun the engine's change effect for an unchanged schema.
  const onChangeRef = useRef({ sessionKey, onChange });
  useLayoutEffect(() => {
    onChangeRef.current = { sessionKey, onChange };
  }, [sessionKey, onChange]);
  const onEngineChange = useCallback(
    (next: OrigamixPageSchema): void => {
      if (
        !readOnly &&
        !switching &&
        readySession.current === mountedSession &&
        onChangeRef.current.sessionKey === sessionKey
      )
        onChangeRef.current.onChange(next, { immediate: mode === 'logic' });
    },
    [readOnly, mode, sessionKey, switching, mountedSession],
  );

  return (
    <div className='relative border-t flex min-h-0 flex-1 flex-col bg-white dark:bg-zinc-950'>
      {switching ? (
        <div role='status' className='grid flex-1 place-items-center text-sm text-muted-foreground'>
          正在切换编辑会话…
        </div>
      ) : (
        <EditorProvider
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
      )}
    </div>
  );
};
