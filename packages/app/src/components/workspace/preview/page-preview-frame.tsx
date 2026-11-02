import { Button } from '@origamix/ui';
import { EyeOff, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PreviewRenderReport, PreviewSnapshot } from '@origamix/shared';
import { isPreviewToHostMessage, type HostToPreviewMessage } from '@/preview/protocol';
import { runtimeService } from '@/services/runtime';
import { projectsService } from '@/services/projects';
import { schemaService } from '@/services/schema';
import type { AppTheme } from '@/store/preferences';

interface PagePreviewFrameProps {
  active: boolean;
  projectId: string;
  pageId: string;
  pageName: string;
  schemaRefreshKey: string;
  theme: AppTheme;
  onExit: () => void;
}

export const PagePreviewFrame = ({
  active,
  projectId,
  pageId,
  pageName,
  schemaRefreshKey,
  theme,
  onExit,
}: PagePreviewFrameProps): React.JSX.Element => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [snapshot, setSnapshot] = useState<PreviewSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const currentSnapshot = useRef<PreviewSnapshot | null>(null);
  const reportSequence = useRef(0);
  const observedAt = useRef(0);
  const ready = useRef(false);
  useEffect(
    () => () => {
      generation.current += 1;
      currentSnapshot.current = null;
    },
    [projectId, pageId],
  );
  const previewUrl = useMemo(() => {
    const url = new URL(window.location.href);
    const search = new URLSearchParams({ projectId, pageId }).toString();
    if (url.protocol === 'file:') {
      url.search = '';
      url.hash = `/preview?${search}`;
    } else {
      url.pathname = '/preview';
      url.search = search;
      url.hash = '';
    }
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
      const requestGeneration = ++generation.current;
      if (manual) setRefreshing(true);
      try {
        const [result, stack] = await Promise.all([
          schemaService.workingState(projectId, pageId),
          projectsService.stack(projectId),
        ]);
        if (requestGeneration !== generation.current) return;
        const next = {
          ...result,
          stack,
          theme,
          previewId: crypto.randomUUID(),
        } satisfies PreviewSnapshot;
        currentSnapshot.current = next;
        reportSequence.current = 0;
        setSnapshot(next);
        publishSnapshot(next);
        setError(null);
      } catch (reason) {
        if (requestGeneration !== generation.current) return;
        const message = reason instanceof Error ? reason.message : '无法读取页面';
        setError(message);
        if (ready.current)
          postToPreview({ type: 'origamix.preview.error', projectId, pageId, message });
      } finally {
        if (requestGeneration === generation.current) setRefreshing(false);
      }
    },
    [pageId, postToPreview, projectId, publishSnapshot, theme],
  );

  const reportRender = useCallback(
    async (report: PreviewRenderReport): Promise<void> => {
      const current = currentSnapshot.current;
      if (
        !current ||
        current.previewId !== report.previewId ||
        current.revisionId !== report.revisionId ||
        current.workingVersion !== report.workingVersion ||
        current.workingHash !== report.workingHash ||
        report.reportSequence <= reportSequence.current
      )
        return;
      reportSequence.current = report.reportSequence;
      observedAt.current = Math.max(Date.now(), observedAt.current + 1);
      const isCurrent = () =>
        currentSnapshot.current?.previewId === report.previewId &&
        reportSequence.current === report.reportSequence;
      try {
        const result = await runtimeService.report(projectId, pageId, {
          revisionId: report.revisionId,
          workingVersion: report.workingVersion,
          workingHash: report.workingHash,
          previewId: report.previewId,
          reportSequence: report.reportSequence,
          outcome: report.outcome,
          observedAt: new Date(observedAt.current).toISOString(),
          diagnostics: report.diagnostics.map((diagnostic) => ({
            ...diagnostic,
            pageId,
            revisionId: report.revisionId,
          })),
        });
        if (isCurrent() && result.disposition === 'accepted' && report.outcome === 'success')
          setError(null);
      } catch (reason) {
        if (isCurrent())
          setError(reason instanceof Error ? reason.message : '无法记录页面渲染状态');
      }
    },
    [pageId, projectId],
  );

  useEffect(() => {
    const receive = (event: MessageEvent): void => {
      if (event.source !== iframeRef.current?.contentWindow || !isPreviewToHostMessage(event.data))
        return;
      if (event.data.projectId !== projectId || event.data.pageId !== pageId) return;
      if (event.data.type === 'origamix.preview.ready') {
        ready.current = true;
        if (snapshot) {
          const next = { ...snapshot, previewId: crypto.randomUUID() };
          currentSnapshot.current = next;
          reportSequence.current = 0;
          setSnapshot(next);
          publishSnapshot(next);
        } else void refresh(true);
      } else {
        void reportRender(event.data);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [pageId, projectId, publishSnapshot, refresh, reportRender, snapshot]);

  useEffect(() => {
    if (!active) return;
    const initial = window.setTimeout(() => void refresh(true), 0);
    return () => {
      window.clearTimeout(initial);
    };
  }, [active, refresh, schemaRefreshKey]);

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
