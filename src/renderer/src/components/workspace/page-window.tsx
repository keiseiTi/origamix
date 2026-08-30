import { Button, Spinner, Tooltip } from '@heroui/react';
import { RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PreviewSnapshot } from '../../../../shared/page-window';

const query = new URLSearchParams(window.location.search);

export function PageWindow(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    let active = true;
    let pending = false;
    const refresh = async (manual = false): Promise<void> => {
      if (pending) return;
      pending = true;
      if (manual) setRefreshing(true);
      try {
        const result = await window.preview.readSnapshot();
        if (!active) return;
        setSnapshot((current) =>
          current?.revisionId === result.revisionId && current.theme === result.theme
            ? current
            : result
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
    <main className="flex h-full flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="flex h-15 shrink-0 items-center justify-between gap-4 border-b border-zinc-200 px-5 dark:border-zinc-800">
        <span className="truncate">{query.get('pageName')} - 预览</span>
        <div className="flex items-center gap-3">
          <span role="status" className="text-xs text-zinc-500 dark:text-zinc-400">
            {refreshing ? '刷新中…' : error ? '同步失败' : snapshot ? '已同步' : '加载中…'}
          </span>
          <Tooltip>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label="刷新预览"
              isDisabled={refreshing}
              onPress={() => refreshRef.current()}
            >
              <RefreshCw size={17} />
            </Button>
            <Tooltip.Content>刷新预览</Tooltip.Content>
          </Tooltip>
        </div>
      </header>
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 bg-danger/10 p-4 text-sm text-danger"
        >
          <span>
            {error}。{snapshot ? '保留上次成功预览。' : '请重试。'}
          </span>
          <Button size="sm" variant="secondary" onPress={() => refreshRef.current()}>
            重试
          </Button>
        </div>
      )}
      {snapshot ? (
        <section className="min-h-0 flex-1 overflow-auto p-6">
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            只读 Schema 预览。页面渲染器尚未接入；自动同步已保存的版本。
          </p>
          <pre className="whitespace-pre-wrap break-words rounded-lg bg-zinc-50 p-4 text-xs dark:bg-zinc-900">
            {JSON.stringify(snapshot.schema, null, 2)}
          </pre>
        </section>
      ) : (
        !error && (
          <div className="grid flex-1 place-items-center">
            <Spinner aria-label="读取页面" />
          </div>
        )
      )}
    </main>
  );
}
