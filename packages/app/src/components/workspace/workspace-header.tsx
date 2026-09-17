import { Button, Tooltip } from '@heroui/react';
import { useState } from 'react';
import { Eye, SquarePen, MessageSquare, RefreshCw, Undo2 } from 'lucide-react';
import type { EditorSaveStatus } from '../editor/use-editor-session';

export type WorkspaceMode = 'chat' | 'edit' | 'preview';

interface WorkspaceHeaderProps {
  projectName: string;
  pageName: string;
  mode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => Promise<void>;
  onPreview: () => Promise<void>;
  onUndo: () => Promise<void>;
  onApply: () => Promise<void>;
  onReloadFromProject: () => Promise<void>;
  applyStatus: 'loading' | 'in_sync' | 'pending' | 'external_change' | 'result_pending' | 'error';
  saveStatus: EditorSaveStatus;
  undoDisabled?: boolean;
}

export const WorkspaceHeader = ({
  projectName,
  pageName,
  mode,
  onModeChange,
  onPreview,
  onUndo,
  onApply,
  onReloadFromProject,
  applyStatus,
  saveStatus,
  undoDisabled = false,
}: WorkspaceHeaderProps): React.JSX.Element => {
  const [opening, setOpening] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const undo = async (): Promise<void> => {
    setUndoing(true);
    setError(null);
    try {
      await onUndo();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法撤销页面修改');
    } finally {
      setUndoing(false);
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
  return (
    <header className='relative z-10 flex h-9 min-h-9 items-center justify-between gap-3 px-3 text-xs'>
      <div className='min-w-0 font-medium text-zinc-500 dark:text-zinc-400'>
        <span className='block truncate' title={`${projectName} - ${pageName}`}>
          {projectName} / {pageName}
        </span>
      </div>
      <div className='flex shrink-0 items-center gap-1'>
        <span
          className={
            applyStatus === 'external_change' || applyStatus === 'error'
              ? 'text-danger'
              : 'text-zinc-500 dark:text-zinc-400'
          }
        >
          {saveStatus === 'error'
            ? '保存失败'
            : saveStatus === 'saving'
              ? '保存中…'
              : saveStatus === 'dirty'
                ? '待保存'
                : applyStatus === 'loading'
                  ? '检查状态…'
                  : applyStatus === 'in_sync'
                    ? '与项目一致'
                    : applyStatus === 'pending'
                      ? '已保存 · 待应用'
                      : applyStatus === 'external_change'
                        ? '项目文件已变化'
                        : applyStatus === 'result_pending'
                          ? '应用结果待确认'
                          : '状态不可用'}
        </span>
        {error && (
          <span role='alert' className='max-w-56 truncate text-xs text-danger' title={error}>
            {error}
          </span>
        )}
        <Tooltip>
          <Button
            size='sm'
            variant='secondary'
            className='h-7 min-h-7 px-2 text-xs'
            isDisabled={
              opening ||
              undoing ||
              applying ||
              undoDisabled ||
              saveStatus !== 'saved' ||
              (applyStatus !== 'pending' && applyStatus !== 'result_pending')
            }
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
              isDisabled={reloading || applying || undoDisabled}
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
            aria-label='撤销页面修改'
            variant='ghost'
            className='h-7 min-h-7 w-7 min-w-7 text-zinc-500 dark:text-zinc-400'
            isDisabled={opening || undoing || undoDisabled}
            onPress={() => void undo()}
          >
            <Undo2 size={15} />
          </Button>
          <Tooltip.Content placement='bottom'>撤销上一次页面修改</Tooltip.Content>
        </Tooltip>
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
  );
};
