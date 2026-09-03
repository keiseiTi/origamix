import { Button, Spinner, Tooltip } from '@heroui/react';
import { EyeOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PreviewSnapshot } from '@origamix/shared/page-window';
import { RuntimePreview } from '../editor/mods/runtime-preview';

const query = new URLSearchParams(window.location.search);
const previewTitle = query.get('previewTitle') ?? 'Origamix - 页面预览';

export function PageWindow(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exiting, setExiting] = useState(false);
  const refreshRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    document.title = previewTitle;
    let active = true;
    let pending = false;
    const refresh = async (manual = false): Promise<void> => {
      if (pending) return;
      pending = true;
      if (manual) setRefreshing(true);
      try {
        const result = await window.preview?.readSnapshot?.();
        if (!result) throw new Error('当前环境不支持页面预览，请在桌面应用中打开');
        if (!active) return;
        setSnapshot((current) =>
          current?.revisionId === result.revisionId && current.theme === result.theme
            ? current
            : result,
        );
        setError(null);
        document.documentElement.dataset.theme = result.theme;
        document.documentElement.classList.toggle('dark', result.theme === 'dark');
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : '无法读取页面');
      } finally {
        pending = false;
        if (active) setRefreshing(false);
      }
    };
    refreshRef.current = () => void refresh(true);
    const onFocus = (): void => {
      void refresh();
    };
    void refresh(true);
    // Until the preview SSE transport is connected, only read committed snapshots.
    const timer = window.setInterval(onFocus, 1500);
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return (
    <main className='relative flex h-full flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100'>
      <Tooltip>
        <Button
          isIconOnly
          size='sm'
          variant='secondary'
          className='fixed top-4 right-4 z-50 shadow-md'
          aria-label='退出预览'
          isDisabled={exiting}
          onPress={() => {
            setExiting(true);
            void window.preview?.exit().catch((reason: unknown) => {
              setExiting(false);
              setError(reason instanceof Error ? reason.message : '无法退出预览');
            });
          }}
        >
          <EyeOff size={17} />
        </Button>
        <Tooltip.Content placement='left'>退出预览</Tooltip.Content>
      </Tooltip>
      {error && (
        <div
          role='alert'
          className='fixed top-4 left-1/2 z-40 flex -translate-x-1/2 items-center justify-between gap-3 rounded-lg bg-danger/10 p-4 text-sm text-danger backdrop-blur'
        >
          <span>
            {error}。{snapshot ? '保留上次成功预览。' : '请重试。'}
          </span>
          <Button
            size='sm'
            variant='secondary'
            isDisabled={refreshing}
            onPress={() => refreshRef.current()}
          >
            重试
          </Button>
        </div>
      )}
      {snapshot ? (
        <RuntimePreview schema={snapshot.schema} revisionId={snapshot.revisionId} />
      ) : (
        !error && (
          <div className='grid flex-1 place-items-center'>
            <Spinner aria-label='读取页面' />
          </div>
        )
      )}
    </main>
  );
}
