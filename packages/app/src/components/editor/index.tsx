import { Spinner } from '@heroui/react';
import {
  CanvasEditor,
  DragOverlay,
  EditorProvider,
  useEditorCore,
  type Material,
} from '@tangramino/base-editor';
import type { Schema } from '@tangramino/engine';
import materialGroups from '@origamix/materials/antd/group';
import { forwardRef, useEffect, useImperativeHandle } from 'react';
import { AttributePanel } from './mods/attribute-panel';
import { DropIndicator, EditableElement, EditorOverlay } from './mods/canvas-tools';
import { InsertPositionIndicator } from './mods/insert-position-indicator';
import { MaterialPanel, type MaterialGroup } from './mods/material-panel';
import { useEditorSession, type EditorSaveStatus } from './use-editor-session';

export interface EditorHandle {
  flush: () => Promise<void>;
}

interface EditorProps {
  projectId: string;
  pageId: string;
  readOnly?: boolean;
  readOnlyMessage?: string;
  onSaveStatusChange?: (status: EditorSaveStatus, error: string | null) => void;
}

const groups = materialGroups as MaterialGroup[];
const materials = groups.flatMap((group) => group.children) as Material[];

const EditorCanvas = (): React.JSX.Element => {
  const dragElement = useEditorCore((state) => state.dragElement);

  const dragTitle = (dragElement as Material)?.title ?? '';

  return (
    <>
      <div className='flex size-full min-w-0'>
        <MaterialPanel groups={groups} />
        <main
          className='min-w-0 flex-1 overflow-hidden bg-zinc-100 p-3 dark:bg-zinc-900'
          aria-label='页面画布'
        >
          <div className='mx-auto h-full min-h-full max-w-360 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950'>
            <CanvasEditor
              className='relative size-full overflow-auto p-4'
              renderDropIndicator={DropIndicator}
              renderElement={EditableElement}
              renderOverlayContent={EditorOverlay}
            />
          </div>
        </main>
        <AttributePanel />
      </div>
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
    { projectId, pageId, readOnly = false, readOnlyMessage, onSaveStatusChange },
    ref,
  ): React.JSX.Element => {
    const session = useEditorSession(projectId, pageId, readOnly);
    const { initial, loading, status, error, flush, onChange, providerKey } = session;

    useEffect(() => onSaveStatusChange?.(status, error), [error, onSaveStatusChange, status]);

    useImperativeHandle(ref, () => ({ flush }), [flush]);

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
          schema={initial.schema as Schema}
          onChange={onChange}
        >
          <EditorCanvas />
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
        <div
          role={status === 'error' ? 'alert' : 'status'}
          className={`pointer-events-none absolute right-4 bottom-3 rounded-full border bg-white/90 px-2.5 py-1 text-[11px] shadow-sm backdrop-blur dark:bg-zinc-900/90 ${
            status === 'error'
              ? 'border-danger/40 text-danger'
              : 'border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400'
          }`}
        >
          {status === 'saving'
            ? '正在保留草稿…'
            : status === 'dirty'
              ? '草稿待保留'
              : status === 'error'
                ? error
                : '草稿已保留'}
        </div>
      </div>
    );
  },
);
