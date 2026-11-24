import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@origamix/ui';
import { useState } from 'react';
import { downloadProjectZip } from '@/services/project-export';

export const ProjectExportDialog = ({
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
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      await flushEditor();
      await downloadProjectZip(projectId);
      onClose();
    } catch (reason) {
      toast.add({
        title: reason instanceof Error ? reason.message : '导出失败，请重试。',
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导出项目 ZIP</DialogTitle>
        </DialogHeader>
        <p className='text-sm text-muted-foreground'>
          {name} 的源码和已保存页面将打包下载。请先为修改过的页面保存版本。
        </p>
        <DialogFooter>
          <DialogClose render={<Button variant='outline' disabled={busy} />}>取消</DialogClose>
          <Button disabled={busy} onClick={() => void download()}>
            {busy ? '正在导出…' : '下载 ZIP'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
