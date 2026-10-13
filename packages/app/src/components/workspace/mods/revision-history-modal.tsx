import { CodeEditor } from '@/components/editor/mods/code-editor';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { schemaService } from '@/services/schema';
import type { RevisionHistoryItem } from '@origamix/shared/protocol/api';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { Braces, History, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface RevisionHistoryProps {
  projectId: string;
  pageId: string;
  canRestore: boolean;
  onClose: () => void;
  onRestore: (revisionId: string) => Promise<void>;
}

const formatTime = (value: string): string => {
  const date = new Date(value);
  const pad = (number: number): string => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const RevisionHistoryContent = ({
  projectId,
  pageId,
  canRestore,
  onClose,
  onRestore,
}: RevisionHistoryProps): React.JSX.Element => {
  const [revisions, setRevisions] = useState<RevisionHistoryItem[]>([]);
  const [selected, setSelected] = useState<RevisionHistoryItem | null>(null);
  const [schema, setSchema] = useState<OrigamixPageSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [listAttempt, setListAttempt] = useState(0);
  const [viewAttempt, setViewAttempt] = useState(0);
  const mounted = useRef(false);
  const restorePending = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    schemaService
      .listRevisions(projectId, pageId)
      .then((result) => active && setRevisions(result.revisions))
      .catch((reason) => {
        if (active) setListError(reason instanceof Error ? reason.message : '无法读取版本历史');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [projectId, pageId, listAttempt]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    schemaService
      .getRevision(projectId, pageId, selected.revisionId)
      .then((result) => active && setSchema(result.schema))
      .catch((reason) => {
        if (active) setViewError(reason instanceof Error ? reason.message : '无法读取历史版本');
      })
      .finally(() => active && setViewing(false));
    return () => {
      active = false;
    };
  }, [projectId, pageId, selected, viewAttempt]);

  const view = (revision: RevisionHistoryItem): void => {
    setSelected(revision);
    setSchema(null);
    setViewError(null);
    setViewing(true);
    setViewAttempt((attempt) => attempt + 1);
  };

  const restore = async (revisionId: string): Promise<void> => {
    if (!canRestore || restorePending.current) return;
    if (!window.confirm('恢复此版本将替换当前草稿，不会自动保存版本或应用到项目。是否继续？'))
      return;
    restorePending.current = true;
    setRestoring(revisionId);
    setRestoreError(null);
    try {
      await onRestore(revisionId);
      if (mounted.current) onClose();
    } catch (reason) {
      if (mounted.current)
        setRestoreError(reason instanceof Error ? reason.message : '恢复历史版本失败');
    } finally {
      restorePending.current = false;
      if (mounted.current) setRestoring(null);
    }
  };

  return (
    <>
      <DialogHeader className='shrink-0 border-b border-border px-5 py-4 pr-12'>
        <DialogTitle className='flex items-center gap-2'>
          <History className='size-4 text-muted-foreground' />
          版本历史
        </DialogTitle>
        <DialogDescription>查看已保存的 Schema，或将历史版本恢复到当前草稿。</DialogDescription>
      </DialogHeader>
      <div className='grid min-h-0 flex-1 grid-rows-2 overflow-hidden md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:grid-rows-1'>
        <section
          aria-label='版本列表'
          className='flex min-h-0 min-w-0 flex-col border-b border-border md:border-r md:border-b-0'
        >
          <div className='flex h-11 shrink-0 items-center justify-between border-b border-border px-4'>
            <h3 className='text-sm font-medium'>已保存版本</h3>
            {!loading && !listError && (
              <span className='text-xs text-muted-foreground'>{revisions.length} 个版本</span>
            )}
          </div>
          <div className='min-h-0 flex-1 overflow-auto'>
            {loading ? (
              <div
                role='status'
                className='flex h-full min-h-28 items-center justify-center gap-2 text-muted-foreground'
              >
                <Spinner /> 正在加载版本历史…
              </div>
            ) : listError ? (
              <div className='flex h-full min-h-28 flex-col items-center justify-center gap-3 p-4'>
                <p role='alert' className='text-sm text-danger'>
                  {listError}
                </p>
                <Button
                  size='sm'
                  variant='outline'
                  onClick={() => {
                    setListError(null);
                    setLoading(true);
                    setListAttempt((attempt) => attempt + 1);
                  }}
                >
                  重新加载
                </Button>
              </div>
            ) : revisions.length === 0 ? (
              <div className='flex h-full min-h-28 flex-col items-center justify-center gap-2 p-4 text-muted-foreground'>
                <History className='size-6' />
                <p>暂无已保存版本</p>
                <p className='text-xs'>保存版本后，可在这里查看与恢复。</p>
              </div>
            ) : (
              <table className='w-full min-w-[400px] text-left text-xs' aria-label='历史版本'>
                <thead className='sticky top-0 z-10 bg-muted text-muted-foreground'>
                  <tr className='border-b border-border'>
                    <th scope='col' className='px-4 py-3 font-medium'>
                      时间
                    </th>
                    <th scope='col' className='px-3 py-3 font-medium'>
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {revisions.map((revision) => (
                    <tr
                      key={revision.revisionId}
                      aria-selected={selected?.revisionId === revision.revisionId}
                      className={`border-b border-border transition-colors ${selected?.revisionId === revision.revisionId ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                    >
                      <td className='px-4 py-3 align-top flex items-center'>
                        <time
                          dateTime={revision.createdAt}
                          className='whitespace-nowrap tabular-nums mr-2'
                        >
                          {formatTime(revision.createdAt)}
                        </time>
                        {(revision.isCurrent || revision.isApplied) && (
                          <div className='flex gap-2 text-[10px] text-muted-foreground'>
                            {revision.isCurrent && <span>最近保存</span>}
                            {revision.isApplied && <span>已应用</span>}
                          </div>
                        )}
                      </td>
                      <td className='py-2 align-top'>
                        <div className='flex items-center gap-1 whitespace-nowrap'>
                          <Button
                            size='sm'
                            variant='ghost'
                            aria-label={`查看 ${formatTime(revision.createdAt)} 的版本`}
                            onClick={() => view(revision)}
                          >
                            查看
                          </Button>
                          <Button
                            size='sm'
                            variant='ghost'
                            disabled={!canRestore || restoring !== null}
                            aria-label={`恢复 ${formatTime(revision.createdAt)} 的版本`}
                            onClick={() => void restore(revision.revisionId)}
                          >
                            {restoring === revision.revisionId ? (
                              <Spinner />
                            ) : (
                              <RotateCcw className='size-3.5' />
                            )}
                            {restoring === revision.revisionId ? '恢复中…' : '恢复'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {restoreError && (
            <p
              role='alert'
              className='shrink-0 border-t border-border px-4 py-3 text-xs text-danger'
            >
              {restoreError}
            </p>
          )}
        </section>
        <section aria-label='版本 Schema' className='flex min-h-0 min-w-0 flex-col'>
          <div className='flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-4'>
            <h3 className='flex items-center gap-2 text-sm font-medium'>
              <Braces className='size-4 text-muted-foreground' />
              Schema
            </h3>
            {selected && (
              <span className='truncate text-xs text-muted-foreground'>
                {formatTime(selected.createdAt)}
              </span>
            )}
          </div>
          {viewing ? (
            <div
              role='status'
              className='flex min-h-0 flex-1 items-center justify-center gap-2 text-muted-foreground'
            >
              <Spinner /> 正在加载 Schema…
            </div>
          ) : viewError ? (
            <div className='flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4'>
              <p role='alert' className='text-sm text-danger'>
                {viewError}
              </p>
              <Button size='sm' variant='outline' onClick={() => selected && view(selected)}>
                重试
              </Button>
            </div>
          ) : schema ? (
            <>
              <div className='shrink-0 border-b border-border px-4 py-2'>
                <code className='block break-all select-all font-mono text-[10px] text-muted-foreground'>
                  {selected?.schemaHash}
                </code>
              </div>
              <CodeEditor
                value={JSON.stringify(schema, null, 2)}
                language='json'
                readOnly
                ariaLabel='历史版本 Schema JSON'
                className='h-auto flex-1'
              />
            </>
          ) : (
            <div className='flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-4 text-muted-foreground'>
              <Braces className='size-8' />
              <p className='text-sm'>点击“查看”展示版本 Schema</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export const RevisionHistoryModal = ({
  isOpen,
  ...props
}: RevisionHistoryProps & { isOpen: boolean }): React.JSX.Element => (
  <Dialog open={isOpen} onOpenChange={(open) => !open && props.onClose()}>
    <DialogContent className='flex h-[min(80dvh,800px)]  max-w-[1040px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1040px]'>
      {isOpen && <RevisionHistoryContent key={`${props.projectId}:${props.pageId}`} {...props} />}
    </DialogContent>
  </Dialog>
);
