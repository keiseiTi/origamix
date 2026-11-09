import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@origamix/ui';
import {
  DEFAULT_PROJECT_ROUTING,
  isProjectRouting,
  type ProjectRoutingState,
  type ProjectRouting,
} from '@origamix/shared';
import { projectsService } from '@/services/projects';
import { RoutingFields } from './routing-fields';

export const RoutingDialog = ({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) => {
  const [state, setState] = useState<ProjectRoutingState>();
  const [routing, setRouting] = useState<ProjectRouting>({ ...DEFAULT_PROJECT_ROUTING });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    void projectsService
      .routing(projectId)
      .then((next) => {
        if (current) {
          setState(next);
          setRouting(next.routing);
        }
      })
      .catch((reason: unknown) => {
        if (current) setError(reason instanceof Error ? reason.message : '读取运行设置失败');
      });
    return () => {
      current = false;
    };
  }, [projectId, retry]);
  const save = async () => {
    if (!state) return;
    if (!isProjectRouting(routing)) {
      setError('应用访问前缀应为 / 或 /admin/ 等目录路径，只支持字母、数字、连字符和下划线。');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await projectsService.updateRouting({
        projectId,
        expectedManifestHash: state.manifestHash,
        routing,
      });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败，输入已保留');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <form
          className='grid gap-4'
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <DialogHeader>
            <DialogTitle>项目运行设置</DialogTitle>
          </DialogHeader>
          {state ? (
            <RoutingFields value={routing} onChange={setRouting} disabled={busy} />
          ) : (
            <p role='status'>{error ? '无法读取当前配置。' : '正在读取运行设置…'}</p>
          )}
          <p className='text-xs text-muted-foreground'>
            设置保存在项目清单中。修改后需重新构建并部署目标项目；工作台预览地址保持不变。
          </p>
          {error && (
            <p role='alert' className='text-sm text-destructive'>
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type='button' variant='outline' disabled={busy} onClick={onClose}>
              取消
            </Button>
            {!state && error && (
              <Button
                type='button'
                variant='outline'
                onClick={() => {
                  setError(undefined);
                  setRetry((value) => value + 1);
                }}
              >
                重试读取
              </Button>
            )}
            <Button type='submit' disabled={!state || busy}>
              {busy ? '保存中…' : '保存设置'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
