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
import { useProjectUpgrades } from '@/store/project-upgrades';

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
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(true);
  const requestId = useRef(crypto.randomUUID());
  useEffect(() => {
    mounted.current = true;
    let active = true;
    void projectsService
      .upgradeState(project.id)
      .then((value) => {
        if (active) setState(value);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : '无法检查项目兼容性');
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [project.id, attempt]);
  const submit = async (cancel = false): Promise<void> => {
    if (!state || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (cancel && state.upgrade?.state === 'pending') {
        await projectsService.cancelUpgrade(project.id, state.upgrade.requestId);
      } else {
        if (state.status !== 'configuration_conversion_required') return;
        await flushEditor();
        await projectsService.upgrade(project.id, {
          expectedVersion: '1.0.0',
          expectedManifestHash: state.manifestHash,
          clientRequestId: requestId.current,
        });
        if (mounted.current) {
          setCompleted(true);
          notifyCompleted(project.id);
        }
      }
      const next = await projectsService.upgradeState(project.id);
      if (mounted.current) setState(next);
    } catch (reason) {
      if (mounted.current)
        setError(
          reason instanceof Error ? reason.message : '结果未确认，请重新检查；不会自动重试写入',
        );
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
          <DialogTitle>兼容性检查 · {project.name}</DialogTitle>
          <DialogDescription>
            检查物料契约与页面 Schema。检查不会转换页面或更新项目依赖。
          </DialogDescription>
        </DialogHeader>
        {!state && !error && (
          <p role='status' className='text-sm text-muted-foreground'>
            正在检查…
          </p>
        )}
        {completed && (
          <p role='status' className='text-sm'>
            项目清单格式已转换，页面和依赖保持原样。
          </p>
        )}
        {state && (
          <div className='max-h-80 space-y-3 overflow-auto text-sm text-muted-foreground'>
            <p>
              项目物料：{state.materialSet.id}@{state.materialSet.version}
            </p>
            <p>
              当前支持物料：{state.supportedMaterialSet.id}@{state.supportedMaterialSet.version}
              ；Schema：{state.schemaVersion}
            </p>
            {state.status === 'compatible' && <p role='status'>项目契约兼容，无需升级。</p>}
            {state.status === 'configuration_conversion_required' && (
              <p>检测到旧版项目清单。可以转换配置格式，转换不修改页面、草稿或依赖。</p>
            )}
            {state.issues.map((issue, index) => (
              <p key={index}>{issue}</p>
            ))}
            {state.pages.map((page) => (
              <p key={page.pageId}>
                {page.name}：Schema {page.schemaVersion ?? '无法读取'}
                {page.issue ? '（不兼容）' : '（版本兼容）'}
              </p>
            ))}
          </div>
        )}
        {error && (
          <p role='alert' className='text-sm text-destructive'>
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant='outline' disabled={busy} onClick={onClose}>
            关闭
          </Button>
          <Button
            variant='outline'
            disabled={busy}
            onClick={() => {
              setCompleted(false);
              setState(null);
              setError(null);
              setAttempt((value) => value + 1);
            }}
          >
            重新检查
          </Button>
          {state?.upgrade?.state === 'pending' && (
            <Button variant='outline' disabled={busy} onClick={() => void submit(true)}>
              撤销未写入的旧版升级
            </Button>
          )}
          {state?.status === 'configuration_conversion_required' && (
            <Button disabled={busy} onClick={() => void submit()}>
              {busy ? '正在转换…' : '转换项目清单'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
