import { Button } from '@/components/ui/button';
import { EyeOff, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PreviewRenderDiagnostic, PreviewSnapshot } from '@origamix/shared/page-window';
import { isPreviewToHostMessage, type HostToPreviewMessage } from '@/preview/protocol';
import { runtimeService } from '@/services/runtime';
import { schemaService } from '@/services/schema';
import type { AppTheme } from '@/store/preferences';

interface PagePreviewFrameProps {
  active: boolean;
  projectId: string;
  pageId: string;
  pageName: string;
  theme: AppTheme;
  onExit: () => void;
}

export const PagePreviewFrame = ({
  active,
  projectId,
  pageId,
  pageName,
  theme,
  onExit,
}: PagePreviewFrameProps): React.JSX.Element => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pending = useRef(false);
  const ready = useRef(false);
  const reported = useRef(new Set<string>());
  const previewUrl = useMemo(() => {
    const url = new URL('/preview', window.location.origin);
    url.search = new URLSearchParams({ projectId, pageId }).toString();
    return url.toString();
  }, [pageId, projectId]);

  useEffect(() => {
    ready.current = false;
  }, [previewUrl]);

  const postToPreview = useCallback((message: HostToPreviewMessage): void => {
    iframeRef.current?.contentWindow?.postMessage(message, '*');
  }, []);

  const publishSnapshot = useCallback(
    (next: PreviewSnapshot): void => {
      if (ready.current)
        postToPreview({ type: 'origamix.preview.snapshot', projectId, pageId, snapshot: next });
    },
    [pageId, postToPreview, projectId],
  );

  const refresh = useCallback(
    async (manual = false): Promise<void> => {
      if (pending.current) return;
      pending.current = true;
      if (manual) setRefreshing(true);
      try {
        const result = await schemaService.get(projectId, pageId);
        const next = { ...result, theme } satisfies PreviewSnapshot;
        setSnapshot(next);
        publishSnapshot(next);
        setError(null);
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : '无法读取页面';
        setError(message);
        if (ready.current)
          postToPreview({ type: 'origamix.preview.error', projectId, pageId, message });
      } finally {
        pending.current = false;
        setRefreshing(false);
      }
    },
    [pageId, postToPreview, projectId, publishSnapshot, theme],
  );

  const reportRender = useCallback(
    async (
      revisionId: string,
      outcome: 'success' | 'failed',
      diagnostics: PreviewRenderDiagnostic[],
    ): Promise<void> => {
      const reportKey = `${revisionId}:${outcome}`;
      if (reported.current.has(reportKey)) return;
      reported.current.add(reportKey);
      try {
        const result = await runtimeService.report(projectId, pageId, {
          revisionId,
          outcome,
          diagnostics: diagnostics.map((diagnostic) => ({ ...diagnostic, pageId, revisionId })),
          observedAt: new Date().toISOString(),
        });
        if (result.visualRevisionId && result.visualRevisionId !== revisionId) {
          const visual = await schemaService.getRevision(
            projectId,
            pageId,
            result.visualRevisionId,
          );
          const fallback = { ...visual, theme } satisfies PreviewSnapshot;
          setSnapshot(fallback);
          publishSnapshot(fallback);
          setError('当前版本渲染失败，已回退到最近一次正常预览');
        } else if (outcome === 'success') setError(null);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '无法记录页面渲染状态');
      }
    },
    [pageId, projectId, publishSnapshot, theme],
  );

  useEffect(() => {
    const receive = (event: MessageEvent): void => {
      if (event.source !== iframeRef.current?.contentWindow || !isPreviewToHostMessage(event.data))
        return;
      if (event.data.projectId !== projectId || event.data.pageId !== pageId) return;
      if (event.data.type === 'origamix.preview.ready') {
        ready.current = true;
        if (snapshot) publishSnapshot(snapshot);
        else void refresh(true);
      } else void reportRender(event.data.revisionId, event.data.outcome, event.data.diagnostics);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [pageId, projectId, publishSnapshot, refresh, reportRender, snapshot]);

  useEffect(() => {
    if (!active) return;
    const initial = window.setTimeout(() => void refresh(true), 0);
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [active, refresh]);

  useEffect(() => {
    if (!snapshot || snapshot.theme === theme) return;
    publishSnapshot({ ...snapshot, theme });
  }, [publishSnapshot, snapshot, theme]);

  return (
    <div className='relative size-full bg-white dark:bg-zinc-950'>
      <iframe
        ref={iframeRef}
        title={`${pageName} 预览`}
        className='size-full border-0 bg-white dark:bg-zinc-950'
        sandbox='allow-same-origin allow-scripts'
        src={previewUrl}
      />
      <Button
        size='icon-sm'
        variant='secondary'
        className='absolute top-3 right-3 z-50 shadow-md'
        aria-label='退出预览'
        onClick={onExit}
      >
        <EyeOff size={17} />
      </Button>
      {error && (
        <div
          role='alert'
          className='absolute top-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-danger/10 p-4 text-sm text-danger backdrop-blur'
        >
          <span>
            {error}。{snapshot ? '保留上次成功预览。' : '请重试。'}
          </span>
          <Button
            size='icon-sm'
            variant='secondary'
            aria-label='重试预览'
            disabled={refreshing}
            onClick={() => void refresh(true)}
          >
            <RefreshCw size={15} />
          </Button>
        </div>
      )}
    </div>
  );
};
