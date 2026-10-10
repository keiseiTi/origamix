import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useWorkspaceStore } from '@/store/workspace';

export const WorkspaceRestoreView = (): React.JSX.Element => {
  const error = useWorkspaceStore((state) => state.workspaceError);

  return (
    <section
      className='flex min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-white text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400'
      aria-busy={!error}
      aria-label='恢复工作区'
    >
      {error ? (
        <>
          <p role='alert'>工作区恢复失败：{error}</p>
          <Button variant='secondary' onClick={() => window.location.reload()}>
            重新加载
          </Button>
        </>
      ) : (
        <>
          <Spinner aria-label='正在恢复工作区' />
          <p role='status'>正在恢复工作区…</p>
        </>
      )}
    </section>
  );
};
