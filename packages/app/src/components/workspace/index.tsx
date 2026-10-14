import { useWorkspaceRestore } from '@/hooks/use-workspace-restore';
import { WorkspaceContent, type WorkspaceContentProps } from './workspace-content';
import { PageTabs } from './page-tabs';

interface WorkspaceProps extends WorkspaceContentProps {
  onSelectPage: (pageId: string) => void;
  onClosePage: (pageId: string) => void;
  transitionError: string | null;
}

export const Workspace = ({
  onSelectPage,
  onClosePage,
  transitionError,
  ...contentProps
}: WorkspaceProps): React.JSX.Element => {
  useWorkspaceRestore();

  return (
    <section aria-label='工作区' className='flex min-h-0 min-w-0 flex-1 flex-col'>
      <header className='flex shrink-0 flex-col'>
        <PageTabs onSelect={onSelectPage} onClose={onClosePage} />
      </header>
      <div className='relative flex min-h-0 min-w-0 flex-1'>
        <WorkspaceContent {...contentProps} />
        {transitionError && (
          <div
            role='alert'
            className='fixed bottom-4 left-1/2 z-50 rounded-lg bg-danger p-3 text-danger-foreground'
          >
            操作未完成：{transitionError}。编辑内容已保留，请重试。
          </div>
        )}
      </div>
    </section>
  );
};

export type { WorkspaceMode } from './page-toolbar';
