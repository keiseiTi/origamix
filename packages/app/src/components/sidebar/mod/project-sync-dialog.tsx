import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@origamix/ui';
import { useEffect, useState } from 'react';
import {
  pickProjectParent,
  readProjectDirectory,
  requestProjectDirectoryAccess,
  supportsProjectDirectory,
  type ProjectDirectoryBinding,
} from '@/services/project-directory';
import {
  bindProjectParent,
  downloadProjectZip,
  syncProjectToDirectory,
} from '@/services/project-sync';

export const ProjectSyncDialog = ({
  projectId,
  name,
  flushEditor,
  onClose,
}: {
  projectId: string;
  name: string;
  flushEditor: () => Promise<void>;
  onClose: () => void;
}) => {
  const supported = supportsProjectDirectory();
  const [binding, setBinding] = useState<ProjectDirectoryBinding>();
  const [loading, setLoading] = useState(supported);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string }>();
  useEffect(() => {
    if (!supported) return;
    let active = true;
    void readProjectDirectory(projectId)
      .then((value) => {
        if (active) setBinding(value);
      })
      .catch(() => {
        if (active) setFeedback({ error: true, text: '无法读取浏览器中的目录授权。' });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, supported]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setFeedback(undefined);
    try {
      await action();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        setFeedback({
          error: true,
          text: error instanceof Error ? error.message : '操作失败，请重试',
        });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>同步到本地</DialogTitle>
        </DialogHeader>
        <div className='grid gap-3 text-sm'>
          <p className='font-medium'>{name}</p>
          {supported ? (
            <>
              <p className='text-muted-foreground'>
                {loading
                  ? '正在读取目录授权…'
                  : binding
                    ? `目标目录：${binding.parent.name}/${binding.code}`
                    : '选择父目录后，Origamix 会在其中初始化项目子目录。'}
              </p>
              {binding?.receipt && (
                <p className='text-muted-foreground'>
                  上次同步 {new Date(binding.receipt.completedAt).toLocaleString()}
                </p>
              )}
              <div className='flex flex-wrap gap-2'>
                <Button
                  variant='outline'
                  disabled={busy || loading}
                  onClick={() =>
                    void run(async () => {
                      setBinding(await bindProjectParent(projectId, await pickProjectParent()));
                    })
                  }
                >
                  {binding ? '更换父目录' : '选择父目录'}
                </Button>
                {binding && (
                  <Button
                    variant='outline'
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        if ((await requestProjectDirectoryAccess(binding.parent)) !== 'granted')
                          throw new Error('目录写入权限未授予');
                        setFeedback({ error: false, text: '目录已授权，可以同步。' });
                      })
                    }
                  >
                    重新授权
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className='text-muted-foreground'>
              当前浏览器可以下载完整项目 ZIP。使用支持目录写入的浏览器即可直接同步到本机。
            </p>
          )}
          <p className='text-muted-foreground'>
            同步和导出使用已保存的页面版本。请先保存修改过的页面。
          </p>
          {feedback && (
            <p
              role={feedback.error ? 'alert' : 'status'}
              className={feedback.error ? 'text-destructive' : 'text-foreground'}
            >
              {feedback.text}
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant='ghost' />}>关闭</DialogClose>
          <Button
            variant='outline'
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await flushEditor();
                await downloadProjectZip(projectId);
                setFeedback({ error: false, text: '项目 ZIP 已开始下载。' });
              })
            }
          >
            下载项目 ZIP
          </Button>
          {supported && (
            <Button
              disabled={!binding || busy || loading}
              onClick={() =>
                void run(async () => {
                  await flushEditor();
                  await syncProjectToDirectory(projectId);
                  setBinding(await readProjectDirectory(projectId));
                  setFeedback({ error: false, text: '已同步到本地。' });
                })
              }
            >
              {busy ? '处理中…' : '同步到本地'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
