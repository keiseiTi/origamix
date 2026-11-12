import { useWorkspaceStore } from '@/store/workspace';
import { EditorToolbar } from '@origamix/editor';
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
import type { EditorTool } from './editor-tool-dialog';
import { RevisionActions, type ApplyStatus } from './toolbar/revision-actions';
export type { WorkspaceMode } from '@/store/workspace';
export interface PageToolbarProps {
  active: boolean;
  canPreview?: boolean;
  saveBusy?: boolean;
  projectName: string;
  pageName: string;
  projectId: string;
  pageId: string;
  navigation: 'chat' | 'edit';
  children?: ReactNode;
  onSaveVersion: () => Promise<void>;
  onRefreshState?: () => Promise<void>;
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
  canPreview = true,
  saveBusy,
  projectName,
  pageName,
  projectId,
  pageId,
  navigation,
  children,
  onSaveVersion,
  onRefreshState,
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
  const changePageMode = useWorkspaceStore((state) => state.changePageMode);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const openPreview = async (): Promise<void> => {
    setOpening(true);
    setError(null);
    try {
      await changePageMode(pageId, 'preview');
    } finally {
      setOpening(false);
    }
  };
  return (
    <>
      <EditorToolbar>
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
              <DropdownMenuItem
                disabled={applyStatus === 'disabled'}
                onClick={() => setHistoryOpen(true)}
              >
                <History /> Schema 历史管理
              </DropdownMenuItem>
              {onOpenEditorTool && (
                <>
                  {
                    <DropdownMenuItem onClick={() => onOpenEditorTool('globals')}>
                      <ListTree /> 全局变量
                    </DropdownMenuItem>
                  }
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
            saveBusy={saveBusy}
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
          {applyStatus === 'error' && onRefreshState && (
            <Button size='sm' variant='outline' onClick={() => void onRefreshState()}>
              重新检查状态
            </Button>
          )}
          {error && (
            <span role='alert' className='max-w-56 truncate text-xs text-danger' title={error}>
              {error}
            </span>
          )}
          {
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
                      void changePageMode(pageId, navigation);
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
          }
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size='icon-sm'
                  variant='ghost'
                  className='text-zinc-500 dark:text-zinc-400'
                  aria-label={canPreview ? '预览' : '暂时无法预览'}
                  disabled={opening || !canPreview}
                  onClick={() => void openPreview()}
                />
              }
            >
              <Eye size={15} />
            </TooltipTrigger>
            <TooltipContent side='bottom'>预览当前页面</TooltipContent>
          </Tooltip>
        </div>
      </EditorToolbar>
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
