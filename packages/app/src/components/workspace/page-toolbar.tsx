import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@origamix/ui';

import { useState, type ReactNode } from 'react';
import {
  Braces,
  Eye,
  History,
  ListTree,
  MessageSquare,
  SquarePen,
  TableOfContents,
} from 'lucide-react';
import { RevisionHistoryDialog } from './history/revision-history-dialog';
import type { EditorTool } from '@origamix/editor';
import { RevisionActions, type ApplyStatus } from './toolbar/revision-actions';

export type WorkspaceMode = 'chat' | 'edit' | 'preview';

export interface PageToolbarProps {
  active: boolean;
  projectName: string;
  pageName: string;
  projectId: string;
  pageId: string;
  navigation: 'chat' | 'edit';
  children?: ReactNode;
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
  onOpenEditorTool?: (tool: EditorTool | null) => void;
}

export const PageToolbarShell = ({
  active,
  projectName,
  pageName,
  projectId,
  pageId,
  navigation,
  children,
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
  onOpenEditorTool,
}: PageToolbarProps): React.JSX.Element => {
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
              {onOpenEditorTool && (
                <>
                  <DropdownMenuItem onClick={() => onOpenEditorTool('globals')}>
                    <ListTree /> 全局变量
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onOpenEditorTool('schema')}>
                    <Braces /> Schema 编辑器
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <span
            className='block truncate text-sm font-medium text-zinc-600 dark:text-zinc-300'
            title={`${projectName} - ${pageName}`}
          >
            {projectName} / {pageName}
          </span>
        </div>
        {children}
        <div className='flex shrink-0 items-center gap-1'>
          <RevisionActions
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
                  aria-label={navigation === 'chat' ? '返回对话' : '编辑'}
                  variant='ghost'
                  className='text-zinc-500 dark:text-zinc-400'
                  disabled={opening}
                  onClick={() => {
                    setError(null);
                    void onModeChange(navigation).catch((reason: unknown) =>
                      setError(
                        reason instanceof Error ? reason.message : '切换失败，编辑内容已保留',
                      ),
                    );
                  }}
                />
              }
            >
              {navigation === 'chat' ? <MessageSquare size={15} /> : <SquarePen size={15} />}
            </TooltipTrigger>
            <TooltipContent side='bottom'>
              {navigation === 'chat' ? '返回对话' : '编辑'}
            </TooltipContent>
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
        <RevisionHistoryDialog
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
