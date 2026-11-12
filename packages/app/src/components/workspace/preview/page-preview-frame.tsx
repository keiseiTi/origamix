import { nanoid } from 'nanoid';
import { Button } from '@origamix/ui';
import { EyeOff, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ApplicationRenderReport, ApplicationSnapshot } from '@origamix/shared';
import { isPreviewToHostMessage, type HostToPreviewMessage } from '@/preview/protocol';
import { runtimeService } from '@/services/runtime';
import { loadApplicationSnapshot } from '@/preview/load-application-snapshot';
import type { AppTheme } from '@/store/preferences';
interface PagePreviewFrameProps {
  active: boolean;
  targetKind?: 'page';
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
}: PagePreviewFrameProps): React.JSX.Element | null => {
  const [opened, setOpened] = useState(active);
  if (active && !opened) setOpened(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [snapshot, setSnapshot] = useState<ApplicationSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);
  const currentSnapshot = useRef<ApplicationSnapshot | null>(null);
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
    (next: ApplicationSnapshot): void => {
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
        const next = await loadApplicationSnapshot(projectId, pageId, theme);
        if (requestGeneration !== generation.current) return;
        currentSnapshot.current = next;
        reportSequence.current = 0;
        setSnapshot(next);
        publishSnapshot(next);
        setError(null);
      } catch (reason) {
        if (requestGeneration !== generation.current) return;
        const message = reason instanceof Error ? reason.message : '无法读取页面';
        setError(message);
      } finally {
        if (requestGeneration === generation.current) setRefreshing(false);
      }
    },
    [pageId, projectId, publishSnapshot, theme],
  );
  const reportRender = useCallback(
    async (report: ApplicationRenderReport): Promise<void> => {
      const current = currentSnapshot.current;
      const page = current?.pageSchemas[report.pageId];
      if (
        !current ||
        !page ||
        current.snapshotId !== report.snapshotId ||
        page.hash !== report.pageHash ||
        report.reportSequence <= reportSequence.current
      )
        return;
      reportSequence.current = report.reportSequence;
      // Only the current page Working identity can publish diagnostics.
      if (!page.revisionId || page.workingVersion === null) return;
      observedAt.current = Math.max(Date.now(), observedAt.current + 1);
      const isCurrent = () =>
        currentSnapshot.current?.snapshotId === report.snapshotId &&
        reportSequence.current === report.reportSequence;
      try {
        const result = await runtimeService.report(projectId, report.pageId, {
          revisionId: page.revisionId,
          workingVersion: page.workingVersion,
          workingHash: page.hash,
          previewId: report.snapshotId,
          reportSequence: report.reportSequence,
          outcome: report.outcome,
          observedAt: new Date(observedAt.current).toISOString(),
          diagnostics: report.diagnostics.map((diagnostic) => ({
            ...diagnostic,
            pageId: report.pageId,
            revisionId: page.revisionId!,
          })),
        });
        if (isCurrent() && result.disposition === 'accepted' && report.outcome === 'success')
          setError(null);
      } catch (reason) {
        if (isCurrent())
          setError(reason instanceof Error ? reason.message : '无法记录页面渲染状态');
      }
    },
    [projectId],
  );
  useEffect(() => {
    const receive = (event: MessageEvent): void => {
      if (event.source !== iframeRef.current?.contentWindow || !isPreviewToHostMessage(event.data))
        return;
      if (event.data.projectId !== projectId || event.data.pageId !== pageId) return;
      if (event.data.type === 'origamix.preview.ready') {
        ready.current = true;
        // Read completion can precede React's commit. Read the same authority
        // used by report validation so readiness never misses that snapshot.
        const retained = currentSnapshot.current;
        if (retained) {
          const next = { ...retained, snapshotId: nanoid() };
          currentSnapshot.current = next;
          reportSequence.current = 0;
          setSnapshot(next);
          publishSnapshot(next);
        }
      } else {
        void reportRender(event.data.report);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [pageId, projectId, publishSnapshot, reportRender]);
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
  if (!opened) return null;
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
      <Button
        size='icon-sm'
        variant='secondary'
        className='absolute top-3 right-14 z-50 shadow-md'
        aria-label='刷新应用预览'
        disabled={refreshing}
        onClick={() => void refresh(true)}
      >
        <RefreshCw size={17} className={refreshing ? 'animate-spin' : undefined} />
      </Button>
      {error && (
        <div
          role='alert'
          className='absolute top-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-danger/10 p-4 text-sm text-danger backdrop-blur'
        >
          <span>
            {error}。{snapshot ? '保留上次应用快照。' : '请重试。'}
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
