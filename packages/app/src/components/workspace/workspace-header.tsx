import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useEffect, useState } from 'react';
import {
  Braces,
  Eye,
  GitBranch,
  History,
  ListTree,
  MessageSquare,
  Monitor,
  Redo2,
  RefreshCw,
  Save,
  Smartphone,
  SquarePen,
  TableOfContents,
  Undo2,
} from 'lucide-react';
import { RevisionHistoryModal } from './revision-history-modal';
import type { EditorHistoryState, EditorTool } from '../editor';

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
  viewportWidth: number;
  onViewportWidthChange: (width: number) => void;
  historyState: EditorHistoryState;
  onUndo: () => void;
  onRedo: () => void;
  onOpenEditorTool: (tool: EditorTool | null) => void;
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
  viewportWidth,
  onViewportWidthChange,
  historyState,
  onUndo,
  onRedo,
  onOpenEditorTool,
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
      <header className='relative z-10 flex h-12 min-h-12 items-center justify-between gap-3 border-b border-border px-3 text-xs'>
        <div className='flex min-w-0 items-center gap-1'>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size='icon-sm'
                  variant='ghost'
                  aria-label='页面工具'
                  className='shrink-0 text-zinc-500 dark:text-zinc-400'
                />
              }
            >
              <TableOfContents size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start'>
              <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
                <History /> Schema 历史管理
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenEditorTool('globals')}>
                <ListTree /> 全局变量
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenEditorTool('logic')}>
                <GitBranch /> 逻辑编辑
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenEditorTool('schema')}>
                <Braces /> Schema 编辑器
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span
            className='block truncate text-sm font-medium text-zinc-600 dark:text-zinc-300'
            title={`${projectName} - ${pageName}`}
          >
            {projectName} / {pageName}
          </span>
        </div>
        {mode === 'edit' && (
          <div className='flex min-w-0 flex-1 items-center justify-center gap-2'>
            <div className='flex rounded-lg bg-muted p-0.5' aria-label='画布设备'>
              <Button
                size='sm'
                variant={viewportWidth === 1440 ? 'secondary' : 'ghost'}
                onClick={() => onViewportWidthChange(1440)}
              >
                <Monitor /> PC
              </Button>
              <Button
                size='sm'
                variant={viewportWidth === 375 ? 'secondary' : 'ghost'}
                onClick={() => onViewportWidthChange(375)}
              >
                <Smartphone /> MOBILE
              </Button>
            </div>
            <label className='flex items-center gap-1 text-muted-foreground'>
              画布宽度
              <Input
                type='number'
                min={240}
                value={viewportWidth}
                className='h-7 w-20'
                aria-label='画布宽度'
                onChange={(event) =>
                  onViewportWidthChange(Math.max(240, Number(event.target.value) || 240))
                }
              />
              px
            </label>
            <div className='flex overflow-hidden rounded-lg border border-border'>
              <Button
                size='icon-sm'
                variant='ghost'
                className='rounded-none border-r border-border'
                aria-label='撤销'
                disabled={!historyState.canUndo}
                onClick={onUndo}
              >
                <Undo2 />
              </Button>
              <Button
                size='icon-sm'
                variant='ghost'
                className='rounded-none'
                aria-label='重做'
                disabled={!historyState.canRedo}
                onClick={onRedo}
              >
                <Redo2 />
              </Button>
            </div>
          </div>
        )}
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
                  disabled={opening || applying || !canApply}
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
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size='icon-sm'
                  aria-label={mode === 'edit' ? '返回对话' : '编辑'}
                  variant='ghost'
                  className='text-zinc-500 dark:text-zinc-400'
                  disabled={opening}
                  onClick={() => void onModeChange(mode === 'edit' ? 'chat' : 'edit')}
                />
              }
            >
              {mode === 'edit' ? <MessageSquare size={15} /> : <SquarePen size={15} />}
            </TooltipTrigger>
            <TooltipContent side='bottom'>{mode === 'edit' ? '返回对话' : '编辑'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size='icon-sm'
                  variant='ghost'
                  className='text-zinc-500 dark:text-zinc-400'
                  aria-label='预览'
                  disabled={opening}
                  onClick={() => void openWindow()}
                />
              }
            >
              <Eye size={15} />
            </TooltipTrigger>
            <TooltipContent side='bottom'>在应用标签中打开预览</TooltipContent>
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
