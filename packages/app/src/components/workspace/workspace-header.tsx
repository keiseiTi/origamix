import { Button, Tooltip } from '@heroui/react';
import { useEffect, useState } from 'react';
import { Clock3, Eye, SquarePen, MessageSquare, RefreshCw, Save } from 'lucide-react';
import { RevisionHistoryModal } from './revision-history-modal';

export type WorkspaceMode = 'chat' | 'edit' | 'preview';

interface WorkspaceHeaderProps {
  active: boolean;
  projectName: string;
  pageName: string;
  projectId: string;
  pageId: string;
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => Promise<void>;
  onPreview: () => Promise<void>;
  onSaveVersion: () => Promise<void>;
  onApply: () => Promise<void>;
  onReloadFromProject: () => Promise<void>;
  onRestoreRevision: (revisionId: string) => Promise<void>;
  applyStatus:
    | 'loading'
    | 'in_sync'
    | 'draft_unsaved'
    | 'saved_pending_apply'
    | 'external_change'
    | 'result_pending'
    | 'error';
  canApply: boolean;
  canSaveVersion: boolean;
  canReload: boolean;
  canRestore: boolean;
}

export const WorkspaceHeader = ({
  active,
  projectName,
  pageName,
  projectId,
  pageId,
  mode,
  onModeChange,
  onPreview,
  onSaveVersion,
  onApply,
  onReloadFromProject,
  onRestoreRevision,
  applyStatus,
  canApply,
  canSaveVersion,
  canReload,
  canRestore,
}: WorkspaceHeaderProps): React.JSX.Element => {
  const [opening, setOpening] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [applying, setApplying] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const openWindow = async (): Promise<void> => {
    setOpening(true);
    setError(null);
    try {
      await onPreview();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法打开预览标签');
    } finally {
      setOpening(false);
    }
  };
  const apply = async (): Promise<void> => {
    setApplying(true);
    setError(null);
    try {
      await onApply();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '应用到项目失败');
    } finally {
      setApplying(false);
    }
  };
  const saveVersion = async (): Promise<void> => {
    setSavingVersion(true);
    setError(null);
    try {
      await onSaveVersion();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存版本失败');
    } finally {
      setSavingVersion(false);
    }
  };
  const reload = async (): Promise<void> => {
    if (!window.confirm('重新读取项目内容会放弃当前未应用修改，是否继续？')) return;
    setReloading(true);
    setError(null);
    try {
      await onReloadFromProject();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '重新读取项目内容失败');
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
      <header className='relative z-10 flex h-9 min-h-9 items-center justify-between gap-3 px-3 text-xs'>
        <div className='min-w-0 font-medium text-zinc-500 dark:text-zinc-400'>
          <span className='block truncate' title={`${projectName} - ${pageName}`}>
            {projectName} / {pageName}
          </span>
        </div>
        <div className='flex shrink-0 items-center gap-1'>
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
          {error && (
            <span role='alert' className='max-w-56 truncate text-xs text-danger' title={error}>
              {error}
            </span>
          )}
          <Tooltip>
            <Button
              isIconOnly
              size='sm'
              variant='ghost'
              aria-label='版本历史'
              className='h-7 min-h-7 w-7 min-w-7 text-zinc-500 dark:text-zinc-400'
              onPress={() => setHistoryOpen(true)}
            >
              <Clock3 size={15} />
            </Button>
            <Tooltip.Content placement='bottom'>查看和恢复历史版本</Tooltip.Content>
          </Tooltip>
          <Tooltip>
            <Button
              size='sm'
              variant='secondary'
              className='h-7 min-h-7 px-2 text-xs'
              isDisabled={savingVersion || applying || !canSaveVersion}
              onPress={() => void saveVersion()}
            >
              <Save size={14} />
              {savingVersion ? '保存中…' : '保存版本'}
            </Button>
            <Tooltip.Content placement='bottom'>把当前草稿保存为可恢复的历史版本</Tooltip.Content>
          </Tooltip>
          <Tooltip>
            <Button
              size='sm'
              variant='secondary'
              className='h-7 min-h-7 px-2 text-xs'
              isDisabled={opening || applying || !canApply}
              onPress={() => void apply()}
            >
              {applying ? '应用中…' : applyStatus === 'result_pending' ? '重试应用' : '应用到项目'}
            </Button>
            <Tooltip.Content placement='bottom'>把当前已保存页面写入真实项目</Tooltip.Content>
          </Tooltip>
          {applyStatus === 'external_change' && (
            <Tooltip>
              <Button
                isIconOnly
                size='sm'
                variant='ghost'
                aria-label='重新读取项目内容'
                isDisabled={reloading || applying || !canReload}
                onPress={() => void reload()}
              >
                <RefreshCw size={15} />
              </Button>
              <Tooltip.Content placement='bottom'>放弃草稿并重新读取项目 Schema</Tooltip.Content>
            </Tooltip>
          )}
          <Tooltip>
            <Button
              isIconOnly
              size='sm'
              aria-label={mode === 'edit' ? '返回对话' : '编辑'}
              variant='ghost'
              className='h-7 min-h-7 w-7 min-w-7 text-zinc-500 dark:text-zinc-400'
              isDisabled={opening}
              onPress={() => void onModeChange(mode === 'edit' ? 'chat' : 'edit')}
            >
              {mode === 'edit' ? <MessageSquare size={15} /> : <SquarePen size={15} />}
            </Button>
            <Tooltip.Content placement='bottom'>
              {mode === 'edit' ? '返回对话' : '编辑'}
            </Tooltip.Content>
          </Tooltip>
          <Tooltip>
            <Button
              isIconOnly
              size='sm'
              variant='ghost'
              className='h-7 min-h-7 w-7 min-w-7 text-zinc-500 dark:text-zinc-400'
              aria-label='预览'
              isDisabled={opening}
              onPress={() => void openWindow()}
            >
              <Eye size={15} />
            </Button>
            <Tooltip.Content placement='bottom'>在应用标签中打开预览</Tooltip.Content>
          </Tooltip>
        </div>
      </header>
      {historyOpen && (
        <RevisionHistoryModal
          isOpen
          projectId={projectId}
          pageId={pageId}
          canRestore={canRestore}
          onClose={() => setHistoryOpen(false)}
          onRestore={onRestoreRevision}
        />
      )}
    </>
  );
};
