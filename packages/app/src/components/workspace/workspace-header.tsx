import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useState } from 'react';
import {
  Braces,
  Eye,
  GitBranch,
  History,
  ListTree,
  MessageSquare,
  SquarePen,
  TableOfContents,
} from 'lucide-react';
import { RevisionHistoryModal } from './mods/revision-history-modal';
import type { EditorHistoryState, EditorTool } from '../editor';
import { CanvasControls } from './mods/canvas-controls';
import { VersionActions, type ApplyStatus } from './mods/version-actions';

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
  applyStatus: ApplyStatus;
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
          <CanvasControls
            viewportWidth={viewportWidth}
            onViewportWidthChange={onViewportWidthChange}
            historyState={historyState}
            onUndo={onUndo}
            onRedo={onRedo}
          />
        )}
        <div className='flex shrink-0 items-center gap-1'>
          <VersionActions
            active={active}
            previewOpening={opening}
            onSaveVersion={onSaveVersion}
            onApply={onApply}
            onReloadFromProject={onReloadFromProject}
            applyStatus={applyStatus}
            canApply={canApply}
            canSaveVersion={canSaveVersion}
            canReload={canReload}
            onErrorChange={setError}
          />
          {error && (
            <span role='alert' className='max-w-56 truncate text-xs text-danger' title={error}>
              {error}
            </span>
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
