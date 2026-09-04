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
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { schemaService } from '../../services/schema';
import { AttributePanel } from './mods/attribute-panel';
import { DropIndicator, EditableElement, EditorOverlay } from './mods/canvas-tools';
import { InsertPositionIndicator } from './mods/insert-position-indicator';
import { MaterialPanel, type MaterialGroup } from './mods/material-panel';

export interface EditorHandle {
  flush: () => Promise<void>;
}

interface EditorProps {
  projectId: string;
  pageId: string;
}

const groups = materialGroups as MaterialGroup[];
const materials = groups.flatMap((group) => group.children) as Material[];

function EditorCanvas(): React.JSX.Element {
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
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { projectId, pageId },
  ref,
): React.JSX.Element {
  const [initial, setInitial] = useState<{
    schema: OrigamixPageSchema;
    revisionId: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [error, setError] = useState<string | null>(null);
  const draftRef = useRef<OrigamixPageSchema | null>(null);
  const savedHashRef = useRef('');
  const revisionRef = useRef('');
  const pendingRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<number | null>(null);
  const providerReadyRef = useRef(false);

  useEffect(() => {
    let active = true;
    schemaService
      .get(projectId, pageId)
      .then((result) => {
        if (!active) return;
        const hash = JSON.stringify(result.schema);
        draftRef.current = result.schema;
        savedHashRef.current = hash;
        revisionRef.current = result.revisionId;
        setInitial(result);
        setStatus('saved');
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : '无法读取 Schema');
          setStatus('error');
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [projectId, pageId]);

  const commit = useCallback(async (): Promise<void> => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    while (true) {
      if (pendingRef.current) await pendingRef.current;
      const draft = draftRef.current;
      const draftHash = draft ? JSON.stringify(draft) : '';
      if (!draft || draftHash === savedHashRef.current) return;
      setStatus('saving');
      setError(null);
      const operation = schemaService
        .replace(projectId, pageId, {
          baseRevisionId: revisionRef.current,
          schema: draft,
        })
        .then((result) => {
          revisionRef.current = result.revisionId;
          savedHashRef.current = JSON.stringify(result.schema);
          setStatus(JSON.stringify(draftRef.current) === savedHashRef.current ? 'saved' : 'dirty');
        })
        .catch((reason) => {
          setError(reason instanceof Error ? reason.message : '保存 Schema 失败');
          setStatus('error');
          throw reason;
        })
        .finally(() => {
          pendingRef.current = null;
        });
      pendingRef.current = operation;
      await operation;
    }
  }, [pageId, projectId]);

  useImperativeHandle(ref, () => ({ flush: commit }), [commit]);

  const onChange = useCallback(
    (schema: Schema): void => {
      if (!providerReadyRef.current) return;
      const next = schema as OrigamixPageSchema;
      const nextHash = JSON.stringify(next);
      draftRef.current = next;
      if (nextHash === savedHashRef.current) {
        setStatus('saved');
        return;
      }
      setStatus('dirty');
      setError(null);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void commit().catch(() => undefined), 700);
    },
    [commit],
  );

  useEffect(() => {
    if (!initial) return;
    const timer = window.setTimeout(() => {
      providerReadyRef.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initial]);

  const providerKey = useMemo(
    () => (initial ? `${projectId}:${pageId}:${initial.revisionId}` : ''),
    [initial, pageId, projectId],
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
      <div role='alert' className='grid min-h-0 flex-1 place-items-center p-6 text-sm text-danger'>
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
      <div
        role={status === 'error' ? 'alert' : 'status'}
        className={`pointer-events-none absolute right-4 bottom-3 rounded-full border bg-white/90 px-2.5 py-1 text-[11px] shadow-sm backdrop-blur dark:bg-zinc-900/90 ${
          status === 'error'
            ? 'border-danger/40 text-danger'
            : 'border-zinc-200 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400'
        }`}
      >
        {status === 'saving'
          ? '保存中…'
          : status === 'dirty'
            ? '待保存'
            : status === 'error'
              ? error
              : '已保存'}
      </div>
    </div>
  );
});
