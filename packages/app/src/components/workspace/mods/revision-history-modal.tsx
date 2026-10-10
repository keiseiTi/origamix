import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import type { RevisionHistoryItem } from '@origamix/shared/protocol/api';
import type { OrigamixPageSchema } from '@origamix/shared/protocol/schema';
import { Check, GitCommitHorizontal, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { schemaService } from '@/services/schema';

const sourceLabel = (revision: RevisionHistoryItem): string => {
  if (revision.source.kind === 'agent') return 'Agent 修改';
  if (revision.source.kind === 'restore') return '历史恢复';
  return '用户保存';
};

export const RevisionHistoryModal = ({
  isOpen,
  projectId,
  pageId,
  canRestore,
  onClose,
  onRestore,
}: {
  isOpen: boolean;
  projectId: string;
  pageId: string;
  canRestore: boolean;
  onClose: () => void;
  onRestore: (revisionId: string) => Promise<void>;
}): React.JSX.Element => {
  const [revisions, setRevisions] = useState<RevisionHistoryItem[]>([]);
  const [selected, setSelected] = useState<{
    revisionId: string;
    schema: OrigamixPageSchema;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    schemaService
      .listRevisions(projectId, pageId)
      .then((result) => active && setRevisions(result.revisions))
      .catch(
        (reason) =>
          active && setError(reason instanceof Error ? reason.message : '无法读取版本历史'),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [isOpen, pageId, projectId]);

  const view = async (revisionId: string): Promise<void> => {
    setError(null);
    try {
      const result = await schemaService.getRevision(projectId, pageId, revisionId);
      setSelected({ revisionId, schema: result.schema });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法读取历史版本');
    }
  };

  const restore = async (revisionId: string): Promise<void> => {
    if (
      !window.confirm(
        '恢复历史版本会替换当前 Working 草稿，但不会自动保存版本或应用到项目。是否继续？',
      )
    )
      return;
    setRestoring(revisionId);
    setError(null);
    try {
      await onRestore(revisionId);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '恢复历史版本失败');
    } finally {
      setRestoring(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='h-[80vh] w-[60vw] max-w-[60vw] sm:max-w-[60vw]'>
        <DialogHeader>
          <DialogTitle>版本历史</DialogTitle>
        </DialogHeader>
        <div className='grid min-h-0 flex-1 grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)] gap-3 overflow-hidden'>
          {loading ? (
            <div className='col-span-2 grid min-h-36 place-items-center'>
              <Spinner aria-label='加载版本历史' />
            </div>
          ) : revisions.length === 0 ? (
            <p className='col-span-2 rounded-lg border border-dashed border-zinc-200 p-5 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400'>
              暂无已保存版本
            </p>
          ) : (
            <ol className='grid content-start gap-2 overflow-y-auto pr-1' aria-label='版本列表'>
              {revisions.map((revision) => (
                <li
                  key={revision.revisionId}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 ${selected?.revisionId === revision.revisionId ? 'border-primary bg-primary/5' : 'border-zinc-200 dark:border-zinc-700'}`}
                >
                  <GitCommitHorizontal className='shrink-0 text-zinc-400' size={17} />
                  <div className='min-w-0 flex-1'>
                    <div className='flex flex-wrap items-center gap-2 text-sm font-medium'>
                      <span>{sourceLabel(revision)}</span>
                      {revision.isCurrent && (
                        <span className='rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary'>
                          最近保存
                        </span>
                      )}
                      {revision.isApplied && (
                        <span className='inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] text-success'>
                          <Check size={11} /> 已应用
                        </span>
                      )}
                    </div>
                    <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                      {new Date(revision.createdAt).toLocaleString()} ·{' '}
                      {revision.schemaHash.slice(0, 10)}
                    </p>
                  </div>
                  <Button size='sm' variant='ghost' onClick={() => void view(revision.revisionId)}>
                    查看
                  </Button>
                  <Button
                    size='sm'
                    variant='secondary'
                    disabled={!canRestore || restoring !== null}
                    onClick={() => void restore(revision.revisionId)}
                  >
                    <RotateCcw size={13} />
                    {restoring === revision.revisionId ? '恢复中…' : '恢复'}
                  </Button>
                </li>
              ))}
            </ol>
          )}
          {selected ? (
            <section
              aria-label='版本内容'
              className='flex min-h-0 flex-col gap-2 rounded-lg border border-border p-3'
            >
              <h3 className='text-sm font-medium'>版本内容</h3>
              <pre className='min-h-0 flex-1 overflow-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200'>
                {JSON.stringify(selected.schema, null, 2)}
              </pre>
            </section>
          ) : !loading && revisions.length > 0 ? (
            <div className='grid place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground'>
              选择左侧版本查看 Schema 内容
            </div>
          ) : null}
          {error && (
            <p role='alert' className='col-span-2 text-sm text-danger'>
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant='outline' />}>关闭</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
