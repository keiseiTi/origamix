import { useEffect, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type ApplyStatus =
  | 'loading'
  | 'in_sync'
  | 'draft_unsaved'
  | 'saved_pending_apply'
  | 'external_change'
  | 'result_pending'
  | 'error';

interface VersionActionsProps {
  active: boolean;
  previewOpening: boolean;
  onSaveVersion: () => Promise<void>;
  onApply: () => Promise<void>;
  onReloadFromProject: () => Promise<void>;
  applyStatus: ApplyStatus;
  canApply: boolean;
  canSaveVersion: boolean;
  canReload: boolean;
  onErrorChange: (error: string | null) => void;
}

export const VersionActions = ({
  active,
  previewOpening,
  onSaveVersion,
  onApply,
  onReloadFromProject,
  applyStatus,
  canApply,
  canSaveVersion,
  canReload,
  onErrorChange,
}: VersionActionsProps): React.JSX.Element => {
  const [savingVersion, setSavingVersion] = useState(false);
  const [applying, setApplying] = useState(false);
  const [reloading, setReloading] = useState(false);

  const saveVersion = async (): Promise<void> => {
    setSavingVersion(true);
    onErrorChange(null);
    try {
      await onSaveVersion();
    } catch (reason) {
      onErrorChange(reason instanceof Error ? reason.message : '保存版本失败');
    } finally {
      setSavingVersion(false);
    }
  };

  const apply = async (): Promise<void> => {
    setApplying(true);
    onErrorChange(null);
    try {
      await onApply();
    } catch (reason) {
      onErrorChange(reason instanceof Error ? reason.message : '应用到项目失败');
    } finally {
      setApplying(false);
    }
  };

  const reload = async (): Promise<void> => {
    if (!window.confirm('重新读取项目内容会放弃当前未应用修改，是否继续？')) return;
    setReloading(true);
    onErrorChange(null);
    try {
      await onReloadFromProject();
    } catch (reason) {
      onErrorChange(reason instanceof Error ? reason.message : '重新读取项目内容失败');
    } finally {
      setReloading(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!active) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      if (canSaveVersion && !savingVersion) void saveVersion();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  return (
    <>
      {applyStatus !== 'draft_unsaved' && (
        <span
          className={
            applyStatus === 'external_change' || applyStatus === 'error'
              ? 'text-danger'
              : 'text-zinc-500 dark:text-zinc-400'
          }
        >
          {applyStatus === 'loading'
            ? '检查状态…'
            : applyStatus === 'in_sync'
              ? '与项目一致'
              : applyStatus === 'saved_pending_apply'
                ? '版本已保存 · 待应用'
                : applyStatus === 'external_change'
                  ? '项目文件已变化'
                  : applyStatus === 'result_pending'
                    ? '应用结果待确认'
                    : '状态不可用'}
        </span>
      )}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size='sm'
              variant='secondary'
              className='px-2 text-xs'
              disabled={savingVersion || applying || !canSaveVersion}
              onClick={() => void saveVersion()}
            />
          }
        >
          <Save size={14} />
          {savingVersion ? '保存中…' : '保存版本'}
        </TooltipTrigger>
        <TooltipContent side='bottom'>把当前草稿保存为可恢复的历史版本</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size='sm'
              variant='secondary'
              className='px-2 text-xs'
              disabled={previewOpening || applying || !canApply}
              onClick={() => void apply()}
            />
          }
        >
          {applying ? '应用中…' : applyStatus === 'result_pending' ? '重试应用' : '应用到项目'}
        </TooltipTrigger>
        <TooltipContent side='bottom'>把当前已保存页面写入真实项目</TooltipContent>
      </Tooltip>
      {applyStatus === 'external_change' && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size='icon-sm'
                variant='ghost'
                aria-label='重新读取项目内容'
                disabled={reloading || applying || !canReload}
                onClick={() => void reload()}
              />
            }
          >
            <RefreshCw size={15} />
          </TooltipTrigger>
          <TooltipContent side='bottom'>放弃草稿并重新读取项目 Schema</TooltipContent>
        </Tooltip>
      )}
    </>
  );
};
