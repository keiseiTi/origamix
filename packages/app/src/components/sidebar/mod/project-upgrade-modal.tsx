import { useProjectUpgrades } from '@/store/project-upgrades';
import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@origamix/ui';
import type { ProjectUpgradeState } from '@origamix/shared';
import { projectsService } from '@/services/projects';

export const ProjectUpgradeModal = ({
  project,
  flushEditor,
  onClose,
}: {
  project: { id: string; name: string };
  flushEditor: () => Promise<void>;
  onClose: () => void;
}) => {
  const notifyCompleted = useProjectUpgrades((state) => state.notifyCompleted);
  const [state, setState] = useState<ProjectUpgradeState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const requestId = useRef<string>(crypto.randomUUID());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    void projectsService
      .upgradeState(project.id)
      .then((result) => {
        if (!active) return;
        setState(result);
        if (
          result.version === result.targetVersion &&
          result.upgrade?.state === 'completed' &&
          result.upgrade.to === result.targetVersion
        )
          setCompleted(true);
        if (result.upgrade?.state === 'pending') requestId.current = result.upgrade.requestId;
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : '无法读取升级状态');
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [project.id, loadKey]);

  const submit = async (cancel = false) => {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (cancel) {
        await projectsService.cancelUpgrade(project.id, requestId.current);
        if (mounted.current) onClose();
        return;
      }
      if (state.upgrade?.state !== 'pending') await flushEditor();
      await projectsService.upgrade(project.id, {
        expectedVersion: state.upgrade?.state === 'pending' ? state.upgrade.from : state.version,
        clientRequestId: requestId.current,
      });
      if (mounted.current) {
        setCompleted(true);
        notifyCompleted(project.id);
      }
    } catch (reason) {
      if (!mounted.current) return;
      setError(reason instanceof Error ? reason.message : '升级结果未确认，请重试');
      // Read recovery status only; never automatically resend the mutation.
      try {
        const next = await projectsService.upgradeState(project.id);
        if (mounted.current) {
          setState(next);
          if (next.upgrade?.state === 'completed' && next.upgrade.requestId === requestId.current) {
            setCompleted(true);
            notifyCompleted(project.id);
          }
          if (next.upgrade?.state === 'pending') requestId.current = next.upgrade.requestId;
        }
      } catch {
        /* Keep the same request identity for an explicit retry. */
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>升级项目 · {project.name}</DialogTitle>
          <DialogDescription>将已保存的页面应用到项目，并统一更新运行依赖。</DialogDescription>
        </DialogHeader>
        {completed ? (
          <p role='status' className='text-sm text-foreground'>
            项目文件已升级。请在项目目录重新安装依赖，再启动和验证页面。
          </p>
        ) : (
          <div className='space-y-3 text-sm text-muted-foreground'>
            <p>
              {state
                ? state.version === state.targetVersion
                  ? `当前版本 ${state.version}`
                  : `${state.version} → ${state.targetVersion}`
                : '正在读取项目版本…'}
            </p>
            <p>
              请先打开所有页面、验证并保存版本，停止项目运行及
              Agent。升级会应用这些已保存页面，并更新项目依赖；完成后需要重新安装依赖。
            </p>
            {state?.upgrade?.state === 'pending' && (
              <p>上次升级尚未完成。继续会使用原请求恢复；只有目标页面和配置尚未改变时才能撤销。</p>
            )}
          </div>
        )}
        {error && (
          <p role='alert' className='text-sm text-destructive'>
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant='outline' disabled={busy} onClick={onClose}>
            {completed ? '完成' : '关闭'}
          </Button>
          {!completed && !state && error && (
            <Button
              onClick={() => {
                setError(null);
                setLoadKey((value) => value + 1);
              }}
            >
              重新读取
            </Button>
          )}
          {!completed && state?.upgrade?.state === 'pending' && (
            <Button variant='outline' disabled={busy} onClick={() => void submit(true)}>
              撤销未写入的升级
            </Button>
          )}
          {!completed && state && (
            <Button disabled={busy} onClick={() => void submit()}>
              {busy
                ? '正在升级…'
                : state.upgrade?.state === 'pending'
                  ? '继续升级'
                  : '升级并应用已保存页面'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
