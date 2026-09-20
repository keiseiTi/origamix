import { Spinner } from '../ui/spinner';
import {
  DragOverlay,
  EditorProvider,
  historyPlugin,
  usePluginContext,
  type HistoryPlugin,
  useEditorCore,
  type Material,
} from '@tangramino/base-editor';
import type { Schema } from '@tangramino/engine';
import materialGroups from '@origamix/materials/antd/group';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { InsertPositionIndicator } from './mods/insert-position-indicator';
import { MainContent } from './mods/main-content';
import type { MaterialGroup } from './mods/material-panel';
import { EditorToolDialog } from './mods/editor-tool-dialog';
import { useEditorSession } from './use-editor-session';

export interface EditorHandle {
  flush: () => Promise<void>;
  redo: () => void;
  undo: () => void;
}

export type EditorTool = 'history' | 'globals' | 'logic' | 'schema';
export interface EditorHistoryState {
  canRedo: boolean;
  canUndo: boolean;
}

interface EditorProps {
  projectId: string;
  pageId: string;
  readOnly?: boolean;
  readOnlyMessage?: string;
  viewportWidth: number;
  tool: Exclude<EditorTool, 'history'> | null;
  onCloseTool: () => void;
  onHistoryStateChange: (state: EditorHistoryState) => void;
}

const groups = materialGroups as MaterialGroup[];
const materials = groups.flatMap((group) => group.children) as Material[];

const HistoryBridge = ({
  historyRef,
  onChange,
}: {
  historyRef: React.MutableRefObject<HistoryPlugin | undefined>;
  onChange: (state: EditorHistoryState) => void;
}): null => {
  const schema = useEditorCore((state) => state.schema);
  const history = usePluginContext<HistoryPlugin>('history');
  useEffect(() => {
    historyRef.current = history;
    onChange({ canUndo: history?.canUndo() ?? false, canRedo: history?.canRedo() ?? false });
  }, [history, historyRef, onChange, schema]);
  return null;
};

const EditorCanvas = ({ viewportWidth }: { viewportWidth: number }): React.JSX.Element => {
  const dragElement = useEditorCore((state) => state.dragElement);

  const dragTitle = (dragElement as Material)?.title ?? '';

  return (
    <>
      <MainContent groups={groups} viewportWidth={viewportWidth} />
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
      projectId,
      pageId,
      readOnly = false,
      readOnlyMessage,
      viewportWidth,
      tool,
      onCloseTool,
      onHistoryStateChange,
    },
    ref,
  ): React.JSX.Element => {
    const session = useEditorSession(projectId, pageId, readOnly);
    const { initial, loading, error, flush, onChange, providerKey } = session;
    const plugins = useMemo(() => [historyPlugin({ limit: 100 })], [providerKey]);
    const historyRef = useRef<HistoryPlugin>();

    useImperativeHandle(
      ref,
      () => ({
        flush,
        undo: () => historyRef.current?.undo(),
        redo: () => historyRef.current?.redo(),
      }),
      [flush],
    );

    if (loading) {
      return (
        <div className='grid min-h-0 flex-1 place-items-center'>
          <Spinner aria-label='加载编辑器' />
        </div>
      );
    }
    if (!initial) {
      return (
        <div
          role='alert'
          className='grid min-h-0 flex-1 place-items-center p-6 text-sm text-danger'
        >
          {error ?? 'Schema 不可用'}
        </div>
      );
    }

    return (
      <div className='relative border-t flex min-h-0 flex-1 flex-col bg-white dark:bg-zinc-950'>
        <EditorProvider
          key={providerKey}
          materials={materials}
          plugins={plugins}
          schema={initial.schema as Schema}
          onChange={onChange}
        >
          <HistoryBridge historyRef={historyRef} onChange={onHistoryStateChange} />
          <EditorCanvas viewportWidth={viewportWidth} />
          <EditorToolDialog tool={tool} onClose={onCloseTool} />
        </EditorProvider>
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
