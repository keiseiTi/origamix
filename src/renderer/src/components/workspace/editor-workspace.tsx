import { Button, Input, Label, Spinner, TextField } from '@heroui/react';
import { FilePlus2, LayoutPanelLeft, Save } from 'lucide-react';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import type { OrigamixPageSchema } from '../../../../shared/protocol/schema';
import { schemaService } from '../../services/schema';

interface EditorWorkspaceProps {
  ref?: Ref<EditorHandle>;
  projectId: string;
  pageId: string;
  fileName: string;
  onStatusChange: (status: string) => void;
}

export interface EditorHandle {
  flush: () => Promise<void>;
  undo: () => Promise<void>;
}

export function EditorWorkspace({
  ref,
  projectId,
  pageId,
  fileName,
  onStatusChange
}: EditorWorkspaceProps): React.JSX.Element {
  const [schema, setSchema] = useState<OrigamixPageSchema | null>(null);
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingSave = useRef<Promise<void> | null>(null);
  const pendingUndo = useRef<Promise<void> | null>(null);
  const status = isSaving
    ? '保存中…'
    : error
      ? '保存或加载失败'
      : !schema
        ? '加载中…'
        : title !== String(schema.elements.element_root?.props.title ?? '')
          ? '未保存'
          : '已保存';
  useEffect(() => onStatusChange(status), [onStatusChange, status]);

  useEffect(() => {
    let active = true;
    schemaService
      .get(projectId, pageId)
      .then((result) => {
        if (!active) return;
        setSchema(result.schema);
        setRevisionId(result.revisionId);
        setTitle(String(result.schema.elements.element_root?.props.title ?? ''));
      })
      .catch(
        (reason) => active && setError(reason instanceof Error ? reason.message : '无法读取 Schema')
      )
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [projectId, pageId]);

  const saveTitle = async (): Promise<void> => {
    if (pendingSave.current) return pendingSave.current;
    // Nothing can be edited before initial hydration, so there is no draft to flush.
    if (!revisionId || !schema) return;
    if (title === String(schema.elements.element_root?.props.title ?? '')) return;
    setIsSaving(true);
    setError(null);
    const operation = (async (): Promise<void> => {
      try {
        const result = await schemaService.updateProps(projectId, pageId, {
          baseRevisionId: revisionId,
          elementId: 'element_root',
          props: { title }
        });
        setSchema(result.schema);
        setRevisionId(result.revisionId);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '保存失败');
        throw reason;
      } finally {
        setIsSaving(false);
      }
    })();
    pendingSave.current = operation;
    try {
      await operation;
    } finally {
      pendingSave.current = null;
    }
  };

  const undo = async (): Promise<void> => {
    if (pendingUndo.current) return pendingUndo.current;
    const operation = (async (): Promise<void> => {
      await saveTitle();
      setIsSaving(true);
      setError(null);
      try {
        const result = await schemaService.undo(projectId, pageId);
        setSchema(result.schema);
        setRevisionId(result.revisionId);
        setTitle(String(result.schema.elements.element_root?.props.title ?? ''));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '撤销失败');
        throw reason;
      } finally {
        setIsSaving(false);
      }
    })();
    pendingUndo.current = operation;
    try {
      await operation;
    } finally {
      pendingUndo.current = null;
    }
  };

  useImperativeHandle(ref, () => ({ flush: () => pendingUndo.current ?? saveTitle(), undo }));

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-zinc-50 p-4 dark:bg-zinc-900">
      <div className="flex h-8 items-center justify-between px-2.5 text-[11px] text-zinc-500 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <FilePlus2 size={14} />
          {fileName}.schema.json
        </span>
      </div>
      <div className="grid min-h-0 flex-1 place-items-center rounded-lg border border-zinc-200 bg-white [background-image:radial-gradient(#e2e2e2_1px,transparent_1px)] [background-size:16px_16px] dark:border-zinc-700 dark:bg-zinc-950 dark:[background-image:radial-gradient(#3f3f46_1px,transparent_1px)]">
        {isLoading ? (
          <Spinner />
        ) : error && !schema ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : schema ? (
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-5 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <LayoutPanelLeft size={20} />
              <strong className="text-zinc-900 dark:text-zinc-100">页面根容器</strong>
            </div>
            <TextField isDisabled={isSaving}>
              <Label className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                标题
              </Label>
              <Input
                disabled={isSaving}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="输入页面标题"
                aria-label="页面标题"
              />
            </TextField>
            {error && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {error}，请重试保存。
              </p>
            )}
            <div className="mt-4 flex justify-between gap-2">
              <Button
                size="sm"
                className="gap-1.5"
                onPress={() => void saveTitle().catch(() => undefined)}
                isDisabled={isSaving}
              >
                <Save size={14} />
                {isSaving ? '保存中…' : '保存变更'}
              </Button>
            </div>
            <p className="mt-4 mb-0 text-[11px] text-zinc-500 dark:text-zinc-400">
              每次保存均会创建 Revision，并以原子方式写入 schema.json。
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
