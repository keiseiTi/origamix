import type { OrigamixPageSchema } from '@origamix/shared';
import { EditorThemeContext, MaterialCatalogContext } from './core/environment';
import { DragOverlay } from './canvas';
import { EditorProvider } from './core/provider';
import { useEditorCore, useEditorStoreApi, type EditorCore } from './core/session';
import { type Material } from './core/material';
import type { OrigamixPageSchema as Schema } from '@origamix/shared';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { InsertPositionIndicator } from './mods/insert-position-indicator';
import { MainContent } from './mods/main-content';
import type { MaterialGroup } from './mods/material-panel';
import { EditorToolDialog } from './mods/editor-tool-dialog';
import { TargetSelectionContext } from './target-selection';

import type {
  EditorMaterialRegistration,
  EditorTheme,
  EditorHandle,
  EditorMode,
  EditorTool,
  EditorHistoryState,
  EditorTargetSelection,
} from './interface';

export interface EditorProps {
  schema: OrigamixPageSchema;
  sessionKey: string;
  registration: EditorMaterialRegistration;
  theme: EditorTheme;
  onChange: (schema: OrigamixPageSchema, options?: { immediate: boolean }) => void;
  onFlush: () => Promise<void>;
  readOnly?: boolean;
  readOnlyMessage?: string;
  viewportWidth: number;
  mode?: EditorMode;
  onModeChange?: (mode: EditorMode) => Promise<void>;
  tool: Exclude<EditorTool, 'history'> | null;
  onCloseTool: () => void;
  onHistoryStateChange: (state: EditorHistoryState) => void;
  targetSelection?: EditorTargetSelection;
}

const HistoryBridge = ({
  historyRef,
  onChange,
}: {
  historyRef: React.RefObject<Pick<EditorCore, 'undo' | 'redo'> | undefined>;
  onChange: (state: EditorHistoryState) => void;
}): null => {
  const store = useEditorStoreApi();
  const canUndo = useEditorCore((state) => state.canUndo);
  const canRedo = useEditorCore((state) => state.canRedo);
  useEffect(() => {
    historyRef.current = store.getState();
    onChange({ canUndo, canRedo });
    return () => {
      historyRef.current = undefined;
    };
  }, [store, historyRef, onChange, canUndo, canRedo]);
  return null;
};

const EditorCanvas = ({
  groups,
  viewportWidth,
  mode,
  onModeChange,
}: {
  groups: MaterialGroup[];
  viewportWidth: number;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => Promise<void>;
}): React.JSX.Element => {
  const dragElement = useEditorCore((state) => state.dragElement);

  const dragTitle = (dragElement as Material)?.title ?? '';

  return (
    <>
      <MainContent
        groups={groups}
        viewportWidth={viewportWidth}
        mode={mode}
        onModeChange={onModeChange}
      />
      <DragOverlay>
        <div className='rounded-md border border-blue-500 bg-white/95 px-3 py-2 text-xs text-blue-700 shadow-lg dark:bg-zinc-900 dark:text-blue-300'>
          {dragTitle}
        </div>
      </DragOverlay>
      <InsertPositionIndicator />
    </>
  );
};

export const Editor = forwardRef<EditorHandle, EditorProps>(
  (
    {
      schema,
      sessionKey,
      registration,
      theme,
      onChange,
      onFlush,
      readOnly = false,
      readOnlyMessage,
      viewportWidth,
      mode = 'view',
      onModeChange = async () => undefined,
      tool,
      onCloseTool,
      onHistoryStateChange,
      targetSelection,
    },
    ref,
  ): React.JSX.Element => {
    const groups = useMemo(
      () =>
        registration.groups.map((group) => ({
          title: group.title,
          children: [...group.children],
        })),
      [registration],
    );
    const materials = useMemo(
      () => [...(registration.rootMaterials ?? []), ...groups.flatMap((group) => group.children)],
      [groups, registration.rootMaterials],
    );
    const historyRef = useRef<Pick<EditorCore, 'undo' | 'redo'> | undefined>(undefined);

    // Host status updates must not rerun the engine's change effect for an unchanged schema.
    const onChangeRef = useRef(onChange);
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);
    const onEngineChange = useCallback(
      (next: Schema): void => {
        if (!readOnly)
          onChangeRef.current(next as OrigamixPageSchema, { immediate: mode === 'logic' });
      },
      [readOnly, mode],
    );

    useImperativeHandle(
      ref,
      () => ({
        flush: onFlush,
        undo: () => historyRef.current?.undo(),
        redo: () => historyRef.current?.redo(),
      }),
      [onFlush],
    );

    return (
      <div className='relative border-t flex min-h-0 flex-1 flex-col bg-white dark:bg-zinc-950'>
        <EditorThemeContext.Provider value={theme}>
          <MaterialCatalogContext.Provider value={registration.catalog.materials}>
            <TargetSelectionContext.Provider value={targetSelection}>
              <EditorProvider
                key={sessionKey}
                materials={materials}
                schema={schema as Schema}
                onChange={onEngineChange}
              >
                <HistoryBridge historyRef={historyRef} onChange={onHistoryStateChange} />
                <EditorCanvas
                  groups={groups}
                  viewportWidth={viewportWidth}
                  mode={mode}
                  onModeChange={onModeChange}
                />
                <EditorToolDialog tool={tool} onClose={onCloseTool} />
              </EditorProvider>
            </TargetSelectionContext.Provider>
          </MaterialCatalogContext.Provider>
        </EditorThemeContext.Provider>
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
    );
  },
);
