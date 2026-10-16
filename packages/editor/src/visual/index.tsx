import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { EditorThemeContext, MaterialCatalogContext } from '../core/environment';
import {
  DragOverlay,
  EditorProvider,
  historyPlugin,
  usePluginContext,
  useEditorCore,
  type Material,
} from '@tangramino/base-editor';
import type { Schema } from '@tangramino/engine';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { InsertPositionIndicator } from './mods/insert-position-indicator';
import { MainContent } from './mods/main-content';
import type { MaterialGroup } from './mods/material-panel';
import { EditorToolDialog } from './mods/editor-tool-dialog';
import { ClarificationHighlightContext } from './clarification-highlight';

import type {
  EditorMaterialRegistration,
  EditorTheme,
  EditorHandle,
  EditorMode,
  EditorTool,
  EditorHistoryState,
} from '../contracts';
export type { EditorHandle, EditorMode, EditorTool, EditorHistoryState } from '../contracts';

export interface EditorProps {
  schema: OrigamixPageSchema;
  sessionKey: string;
  registration: EditorMaterialRegistration;
  theme: EditorTheme;
  onChange: (schema: OrigamixPageSchema) => void;
  onFlush: () => Promise<void>;
  readOnly?: boolean;
  readOnlyMessage?: string;
  viewportWidth: number;
  mode?: EditorMode;
  onModeChange?: (mode: EditorMode) => Promise<void>;
  tool: Exclude<EditorTool, 'history'> | null;
  onCloseTool: () => void;
  onHistoryStateChange: (state: EditorHistoryState) => void;
  clarificationCandidates?: readonly { elementId: string; label: string }[];
  clarificationHighlightedElementId?: string | null;
  clarificationExpired?: boolean;
  onClarificationSelect?: (elementId: string) => void;
}

const HistoryBridge = ({
  historyRef,
  onChange,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  historyRef: React.RefObject<any | undefined>;
  onChange: (state: EditorHistoryState) => void;
}): null => {
  const schema = useEditorCore((state) => state.schema);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const history = usePluginContext<any>('history');
  useEffect(() => {
    historyRef.current = history;
    onChange({ canUndo: history?.canUndo() ?? false, canRedo: history?.canRedo() ?? false });
  }, [history, historyRef, onChange, schema]);
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
      clarificationCandidates = [],
      clarificationHighlightedElementId = null,
      clarificationExpired = false,
      onClarificationSelect,
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
    const materials = useMemo(() => groups.flatMap((group) => group.children), [groups]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const plugins = useMemo(() => [historyPlugin({ limit: 100 })], [sessionKey]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const historyRef = useRef<any>(undefined);

    // Host status updates must not rerun the engine's change effect for an unchanged schema.
    const onChangeRef = useRef(onChange);
    useEffect(() => {
      onChangeRef.current = onChange;
    }, [onChange]);
    const onEngineChange = useCallback(
      (next: Schema): void => {
        if (!readOnly) onChangeRef.current(next as OrigamixPageSchema);
      },
      [readOnly],
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
            <ClarificationHighlightContext.Provider
              value={{
                candidates: clarificationCandidates,
                highlightedElementId: clarificationHighlightedElementId,
                expired: clarificationExpired,
                onSelect: onClarificationSelect,
              }}
            >
              <EditorProvider
                key={sessionKey}
                materials={materials}
                plugins={plugins}
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
            </ClarificationHighlightContext.Provider>
          </MaterialCatalogContext.Provider>
        </EditorThemeContext.Provider>
        {readOnly && (
          <div
            className='absolute inset-0 z-20 grid place-items-center bg-white/45 backdrop-blur-[1px] dark:bg-zinc-950/55'
            role='status'
          >
            <span className='rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'>
              {readOnlyMessage ?? 'AI 正在修改，编辑暂时锁定'}
            </span>
          </div>
        )}
      </div>
    );
  },
);
